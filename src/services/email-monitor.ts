/**
 * Email Monitor Service
 * Polls AgentMail inbox for new messages and replies
 */

import { AgentMailClient, getAgentMailClient } from "../integrations/agentmail.js";
import { EmailCommandParser } from "../utils/email-parser.js";
import type {
  EmailCommandContext,
  ParsedEmailCommand
} from "../types/cost-monitor.js";

export interface EmailMonitorOptions {
  intervalMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface MonitoredReply {
  context: EmailCommandContext;
  parsed: ParsedEmailCommand;
  receivedAt: Date;
}

/**
 * Email Monitor Service
 * Monitors AgentMail inbox for replies to cost report emails
 */
export class EmailMonitorService {
  private agentMailClient: AgentMailClient;
  private isMonitoring: boolean = false;
  private pollInterval?: NodeJS.Timeout;

  constructor(agentMailClient?: AgentMailClient) {
    this.agentMailClient = agentMailClient || getAgentMailClient();
  }

  /**
   * Poll for replies to a specific thread
   * Returns when a reply is detected or timeout is reached
   */
  async pollForReplies(
    threadId: string,
    options: EmailMonitorOptions = {}
  ): Promise<MonitoredReply[]> {
    const {
      intervalMs = 5000,
      timeoutMs = 300000, // 5 minutes default
      maxAttempts = 60
    } = options;

    const startTime = Date.now();
    let attempts = 0;
    const replies: MonitoredReply[] = [];

    // Keep track of seen message IDs to avoid duplicates
    const seenMessageIds = new Set<string>();

    while (attempts < maxAttempts) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Timeout: No replies received after ${timeoutMs}ms`);
      }

      try {
        // List messages in the inbox
        const messages = await this.agentMailClient.listMessages(undefined, {
          limit: 50,
        });

        // Filter messages that belong to the thread and are not from our own inbox
        const threadMessages = messages.filter((msg: any) => {
          const msgThreadId = msg.threadId || msg.thread_id || msg.conversationId;
          const msgFrom = Array.isArray(msg.from) ? msg.from[0] : msg.from;
          const isFromOurInbox = msgFrom?.includes('@agentmail.to');
          const belongsToThread = msgThreadId === threadId;
          const notSeen = !seenMessageIds.has(msg.messageId || msg.message_id);

          return belongsToThread && !isFromOurInbox && notSeen;
        });

        // Process new messages - fetch full content before parsing
        for (const message of threadMessages) {
          const messageId = message.messageId || message.message_id;
          seenMessageIds.add(messageId);

          // Fetch the full message to get body content
          const fullMessage = await this.agentMailClient.getMessage(messageId);

          // Parse the email command with full content
          const context = this.agentMailClient.parseEmailCommand(fullMessage);
          const parsed = EmailCommandParser.parse(context);

          replies.push({
            context,
            parsed,
            receivedAt: new Date(),
          });
        }

        // If we found replies, return them
        if (replies.length > 0) {
          return replies;
        }

        // Wait before next poll
        await this.sleep(intervalMs);
        attempts++;

      } catch (error) {
        throw new Error(
          `Failed to poll for replies: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(`Max attempts reached: No replies after ${maxAttempts} attempts`);
  }

  /**
   * Start monitoring for replies in the background
   * Calls the callback function when a reply is detected
   */
  startMonitoring(
    threadId: string,
    callback: (reply: MonitoredReply) => void | Promise<void>,
    options: EmailMonitorOptions = {}
  ): void {
    if (this.isMonitoring) {
      throw new Error("Already monitoring. Stop current monitoring before starting a new one.");
    }

    const { intervalMs = 5000 } = options;
    const seenMessageIds = new Set<string>();

    this.isMonitoring = true;
    this.pollInterval = setInterval(async () => {
      try {
        const messages = await this.agentMailClient.listMessages(undefined, {
          limit: 50,
        });

        const threadMessages = messages.filter((msg: any) => {
          const msgThreadId = msg.threadId || msg.thread_id || msg.conversationId;
          const msgFrom = Array.isArray(msg.from) ? msg.from[0] : msg.from;
          const isFromOurInbox = msgFrom?.includes('@agentmail.to');
          return msgThreadId === threadId && !isFromOurInbox && !seenMessageIds.has(msg.messageId || msg.message_id);
        });

        for (const message of threadMessages) {
          const messageId = message.messageId || message.message_id;
          seenMessageIds.add(messageId);

          // Fetch the full message to get body content
          const fullMessage = await this.agentMailClient.getMessage(messageId);

          const context = this.agentMailClient.parseEmailCommand(fullMessage);
          const parsed = EmailCommandParser.parse(context);

          const reply: MonitoredReply = {
            context,
            parsed,
            receivedAt: new Date(),
          };

          await callback(reply);
        }
      } catch (error) {
        console.error(
          `Error during monitoring: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }, intervalMs);
  }

  /**
   * Stop background monitoring
   */
  stopMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    this.isMonitoring = false;
  }

  /**
   * Check if currently monitoring
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Wait for a reply with a specific intent
   */
  async waitForIntent(
    threadId: string,
    expectedIntent: string | string[],
    options: EmailMonitorOptions = {}
  ): Promise<MonitoredReply> {
    const intents = Array.isArray(expectedIntent) ? expectedIntent : [expectedIntent];
    const replies = await this.pollForReplies(threadId, options);

    const matchingReply = replies.find(reply =>
      intents.includes(reply.parsed.intent)
    );

    if (!matchingReply) {
      throw new Error(
        `No reply with expected intent(s) found: ${intents.join(", ")}`
      );
    }

    return matchingReply;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a new email monitor service
 */
export function createEmailMonitor(
  agentMailClient?: AgentMailClient
): EmailMonitorService {
  return new EmailMonitorService(agentMailClient);
}
