/**
 * AgentMail Integration
 * Email-based communication for AI agents with human-in-the-loop capabilities
 *
 * Note: This is a simplified wrapper around the AgentMail SDK.
 * For production use, implement full error handling and type safety.
 */

import { AgentMailClient as AgentMailSDK } from "agentmail";
import type {
	WeeklyCostReport,
	EmailCommandContext,
} from "../types/cost-monitor.js";

/**
 * Simple wrapper client for AgentMail
 * Provides a simplified interface for cost monitoring use cases
 */
export class AgentMailClient {
	private client: AgentMailSDK;
	private apiKey: string;
	private defaultInboxId?: string;
	private isInitialized: boolean = false;

	constructor(apiKey?: string) {
		this.apiKey = apiKey || process.env.AGENTMAIL_API_KEY || "";

		if (!this.apiKey) {
			throw new Error(
				"AGENTMAIL_API_KEY is required. Set it in your environment variables.",
			);
		}

		this.client = new AgentMailSDK({ apiKey: this.apiKey });
	}

	/**
	 * Initialize the AgentMail client and create default inbox
	 */
	async initialize(inboxUsername: string = "cloudable"): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// List existing inboxes
			const response = await this.client.inboxes.list({});
			const inboxes = (response as any).inboxes || [];

			// Find existing inbox
			const existingInbox = inboxes.find((inbox: any) =>
				inbox.inboxId?.startsWith(inboxUsername),
			);

			if (existingInbox) {
				this.defaultInboxId = existingInbox.inboxId;
			} else {
				// Create new inbox
				const newInbox = await this.client.inboxes.create({
					username: inboxUsername,
					clientId: `cloudable-inbox-${inboxUsername}`,
				});
				this.defaultInboxId = (newInbox as any).inboxId;
			}

			this.isInitialized = true;
		} catch (error) {
			throw new Error(
				`Failed to initialize AgentMail: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get the default inbox ID
	 */
	getDefaultInboxId(): string {
		if (!this.defaultInboxId) {
			throw new Error(
				"AgentMail client not initialized. Call initialize() first.",
			);
		}
		return this.defaultInboxId;
	}

	/**
	 * Send an email
	 */
	async sendEmail(
		to: string | string[],
		subject: string,
		text?: string,
		html?: string,
		options?: {
			cc?: string[];
			bcc?: string[];
			labels?: string[];
			inboxId?: string;
		},
	): Promise<any> {
		const fromInbox = options?.inboxId || this.defaultInboxId;

		if (!fromInbox) {
			throw new Error("No inbox ID provided and no default inbox set");
		}

		try {
			const recipients = Array.isArray(to) ? to : [to];

			const message = await this.client.inboxes.messages.send(fromInbox, {
				to: recipients,
				subject,
				text,
				html,
				cc: options?.cc,
				bcc: options?.bcc,
				labels: options?.labels,
			});

			return message;
		} catch (error) {
			console.error('[AgentMail] Failed to send email:', error);
			throw new Error(
				`Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * List messages in an inbox
	 */
	async listMessages(
		inboxId?: string,
		options?: { labels?: string[]; limit?: number },
	): Promise<any[]> {
		const targetInbox = inboxId || this.defaultInboxId;

		if (!targetInbox) {
			throw new Error("No inbox ID provided and no default inbox set");
		}

		try {
			const response = await this.client.inboxes.messages.list(targetInbox, {
				labels: options?.labels,
				limit: options?.limit,
			});

			return (response as any).messages || [];
		} catch (error) {
			throw new Error(
				`Failed to list messages: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get a single message with full content
	 */
	async getMessage(messageId: string, inboxId?: string): Promise<any> {
		const targetInbox = inboxId || this.defaultInboxId;

		if (!targetInbox) {
			throw new Error("No inbox ID provided and no default inbox set");
		}

		try {
			const message = await this.client.inboxes.messages.get(
				targetInbox,
				messageId,
			);
			return message;
		} catch (error) {
			throw new Error(
				`Failed to get message: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Reply to a message
	 */
	async replyToMessage(
		messageId: string,
		text?: string,
		html?: string,
		inboxId?: string,
	): Promise<any> {
		const targetInbox = inboxId || this.defaultInboxId;

		if (!targetInbox) {
			throw new Error("No inbox ID provided and no default inbox set");
		}

		try {
			const reply = await this.client.inboxes.messages.reply(
				targetInbox,
				messageId,
				{
					text,
					html,
				},
			);

			return reply;
		} catch (error) {
			throw new Error(
				`Failed to reply to message: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Send a weekly cost report email
	 */
	async sendCostReport(
		report: WeeklyCostReport,
		recipientEmail: string,
		htmlTemplate: string,
		threadId?: string,
	): Promise<{ messageId: string; threadId: string }> {
		const subject = `Cloudable Weekly Cost Report - $${report.costSummary.totalCurrentWeek.toFixed(2)} (${report.costSummary.totalChangePercent >= 0 ? "↑" : "↓"}${Math.abs(report.costSummary.totalChangePercent).toFixed(1)}% vs last week)`;

		const plainText = this.generatePlainTextReport(report);

		const message = await this.sendEmail(
			recipientEmail,
			subject,
			plainText,
			htmlTemplate,
			{
				labels: ["cost-report", "weekly"],
			},
		);

		return {
			messageId: (message as any).messageId || "",
			threadId: (message as any).threadId || threadId || "",
		};
	}

	/**
	 * Parse incoming email command
	 */
	parseEmailCommand(message: any): EmailCommandContext {
		const messageId = message.messageId || message.message_id || "";
		const threadId = message.threadId || message.thread_id || "";
		const from = Array.isArray(message.from) ? message.from[0] : message.from;
		const subject = message.subject || "";
		const bodyText = message.text || message.body || message.plaintext || "";
		const bodyHtml = message.html || message.html_body || undefined;
		const inReplyTo = message.inReplyTo || message.in_reply_to || undefined;

		return {
			messageId,
			threadId,
			from,
			subject,
			bodyText,
			bodyHtml,
			inReplyTo,
		};
	}

	/**
	 * Generate plain text version of cost report (fallback)
	 */
	private generatePlainTextReport(report: WeeklyCostReport): string {
		const lines: string[] = [];

		lines.push("CLOUDABLE WEEKLY COST REPORT");
		lines.push("=".repeat(50));
		lines.push("");

		// Cost Summary
		lines.push("COST SUMMARY");
		lines.push(
			`Current Week: $${report.costSummary.totalCurrentWeek.toFixed(2)}`,
		);
		lines.push(
			`Previous Week: $${report.costSummary.totalPreviousWeek.toFixed(2)}`,
		);
		lines.push(
			`Change: ${report.costSummary.totalChangePercent >= 0 ? "+" : ""}${report.costSummary.totalChangePercent.toFixed(1)}% ($${report.costSummary.totalChangeAmount.toFixed(2)})`,
		);
		lines.push(
			`Monthly Projection: $${report.costSummary.monthlyProjection.toFixed(2)}`,
		);
		lines.push("");

		// Red Flags
		if (report.redFlags.length > 0) {
			lines.push("RED FLAGS DETECTED");
			lines.push("-".repeat(50));
			report.redFlags.forEach((flag, index) => {
				lines.push(
					`${index + 1}. [${flag.severity.toUpperCase()}] ${flag.title}`,
				);
				lines.push(`   ${flag.description}`);
				if (flag.estimatedSavings) {
					lines.push(
						`   Potential Savings: $${flag.estimatedSavings.toFixed(2)}/month`,
					);
				}
				lines.push("");
			});
		}

		// Optimizations
		if (report.optimizations.length > 0) {
			lines.push("COST OPTIMIZATION RECOMMENDATIONS");
			lines.push("-".repeat(50));
			report.optimizations.slice(0, 3).forEach((opt, index) => {
				lines.push(`${index + 1}. ${opt.title}`);
				lines.push(
					`   Estimated Savings: $${opt.estimatedSavings.toFixed(2)}/month`,
				);
				lines.push(`   Effort: ${opt.effort}, Risk: ${opt.risk}`);
				lines.push("");
			});
		}

		// Learning Insights
		if (report.learningInsights.length > 0) {
			lines.push("LEARNING INSIGHTS");
			lines.push("-".repeat(50));
			report.learningInsights.forEach((insight) => {
				lines.push(`• ${insight}`);
			});
			lines.push("");
		}

		lines.push("");
		lines.push("Reply to this email with commands like:");
		lines.push('- "Stop the NAT Gateway"');
		lines.push('- "Approve recommendation #1"');
		lines.push('- "Show me more details"');

		return lines.join("\n");
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		try {
			await this.client.inboxes.list({});
			return true;
		} catch {
			return false;
		}
	}
}

// Export singleton instance
let agentMailInstance: AgentMailClient | null = null;

export function getAgentMailClient(): AgentMailClient {
	if (!agentMailInstance) {
		agentMailInstance = new AgentMailClient();
	}
	return agentMailInstance;
}

export function resetAgentMailClient(): void {
	agentMailInstance = null;
}

// Legacy compatibility
export function createAgentMailClient(apiKey?: string): AgentMailClient {
	return new AgentMailClient(apiKey);
}
