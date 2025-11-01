/**
 * Command Processor Orchestrator
 * Orchestrates the full email command processing workflow
 */

import { AgentMailClient, getAgentMailClient } from "../integrations/agentmail.js";
import { EmailCommandParser } from "../utils/email-parser.js";
import { EmailMonitorService } from "./email-monitor.js";
import { ActionExecutorService } from "./action-executor.js";
import { ConfirmationHandler } from "./confirmation-handler.js";
import type {
  EmailCommandContext,
  ParsedEmailCommand,
  WeeklyCostReport,
} from "../types/cost-monitor.js";
import type { ActionResult, ExecutionContext } from "./action-executor.js";
import type { ConfirmationResult } from "./confirmation-handler.js";

export interface CommandProcessingResult {
  success: boolean;
  command: ParsedEmailCommand;
  actionResult?: ActionResult;
  confirmationResult?: ConfirmationResult;
  message: string;
  requiresClarification: boolean;
  clarificationSent: boolean;
  executed: boolean;
}

/**
 * Command Processor
 * Orchestrates email command parsing, validation, confirmation, and execution
 */
export class CommandProcessor {
  private agentMailClient: AgentMailClient;
  private emailMonitor: EmailMonitorService;
  private actionExecutor: ActionExecutorService;
  private confirmationHandler: ConfirmationHandler;
  private demoMode: boolean;

  constructor(
    agentMailClient?: AgentMailClient,
    emailMonitor?: EmailMonitorService,
    actionExecutor?: ActionExecutorService,
    confirmationHandler?: ConfirmationHandler,
    demoMode: boolean = false
  ) {
    this.agentMailClient = agentMailClient || getAgentMailClient();
    this.emailMonitor =
      emailMonitor || new EmailMonitorService(this.agentMailClient);
    this.actionExecutor =
      actionExecutor || new ActionExecutorService(undefined, demoMode);
    this.confirmationHandler =
      confirmationHandler ||
      new ConfirmationHandler(
        this.agentMailClient,
        this.emailMonitor,
        this.actionExecutor
      );
    this.demoMode = demoMode;
  }

  /**
   * Process an email command end-to-end
   * This is the main orchestration method
   */
  async processEmailCommand(
    context: EmailCommandContext & ExecutionContext,
    waitForConfirmation: boolean = true
  ): Promise<CommandProcessingResult> {
    try {
      // Step 1: Parse the command
      const parsedCommand = EmailCommandParser.parse(context);

      // Step 2: Check if command is ambiguous
      if (EmailCommandParser.isAmbiguous(parsedCommand)) {
        const clarificationSent = await this.sendClarificationRequest(
          context,
          parsedCommand
        );

        return {
          success: false,
          command: parsedCommand,
          message: "Command is ambiguous - clarification requested",
          requiresClarification: true,
          clarificationSent,
          executed: false,
        };
      }

      // Step 3: Log command for debugging
      this.logCommand(parsedCommand, context);

      // Step 4: Check if command requires confirmation
      if (parsedCommand.requiresConfirmation) {
        const confirmationResult =
          await this.confirmationHandler.handleCommandWithConfirmation(
            parsedCommand,
            context,
            waitForConfirmation
          );

        return {
          success: confirmationResult.executed && !!confirmationResult.actionResult?.success,
          command: parsedCommand,
          confirmationResult,
          actionResult: confirmationResult.actionResult,
          message: confirmationResult.message,
          requiresClarification: false,
          clarificationSent: false,
          executed: confirmationResult.executed,
        };
      }

      // Step 5: Execute command directly (no confirmation needed)
      const actionResult = await this.actionExecutor.executeCommand(
        parsedCommand,
        context
      );

      // Step 6: Send result email
      await this.sendResultEmail(context, parsedCommand, actionResult);

      return {
        success: actionResult.success,
        command: parsedCommand,
        actionResult,
        message: actionResult.message,
        requiresClarification: false,
        clarificationSent: false,
        executed: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Send error email to user
      await this.sendErrorEmail(context, errorMessage);

      return {
        success: false,
        command: {
          intent: "unknown",
          confidence: 0,
          rawCommand: context.bodyText,
          extractedEntities: {},
          requiresConfirmation: false,
        },
        message: `Failed to process command: ${errorMessage}`,
        requiresClarification: false,
        clarificationSent: false,
        executed: false,
      };
    }
  }

  /**
   * Send clarification request email
   */
  private async sendClarificationRequest(
    context: EmailCommandContext,
    parsed: ParsedEmailCommand
  ): Promise<boolean> {
    try {
      const clarificationMessage =
        EmailCommandParser.generateClarification(parsed);

      const text = `Clarification Needed

${clarificationMessage}

Original command: "${parsed.rawCommand}"

Please reply with a clearer command and I'll help you right away!`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .command { background: white; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Clarification Needed</h1>
    </div>
    <div class="content">
      <p>${clarificationMessage}</p>

      <div class="command">
        <strong>Original command:</strong><br>
        "${parsed.rawCommand}"
      </div>

      <p>Please reply with a clearer command and I'll help you right away!</p>
    </div>
  </div>
</body>
</html>`;

      await this.agentMailClient.replyToMessage(
        context.messageId,
        text,
        html
      );

      return true;
    } catch (error) {
      console.error(
        `Failed to send clarification request: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Send result email after action execution
   */
  private async sendResultEmail(
    context: EmailCommandContext,
    command: ParsedEmailCommand,
    result: ActionResult
  ): Promise<void> {
    try {
      const summary = EmailCommandParser.summarize(command);

      const isDetailsRequest = command.intent === "get_details";

      const text = result.success
        ? `${isDetailsRequest ? "Here are the details you requested" : "Action Completed Successfully"}

${isDetailsRequest ? "" : summary + "\n\n"}${result.message}

${result.costImpact ? `\nCost Impact:\n- Current: $${result.costImpact.currentMonthlyCost.toFixed(2)}/month\n- Projected: $${result.costImpact.projectedMonthlyCost.toFixed(2)}/month\n- Monthly Savings: $${result.costImpact.monthlySavings.toFixed(2)}` : ""}

${isDetailsRequest ? "\nReply to this email with commands like:\n- \"Stop the development server\"\n- \"Approve recommendation #1\"\n- \"Show me RDS details\"" : "Your AWS resources have been updated."}`
        : `Action Failed

${summary}

${result.message}

${result.error ? `Error: ${result.error}` : ""}

Please check your AWS console or try again.`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${isDetailsRequest ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : result.success ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)" : "linear-gradient(135deg, #dc3545 0%, #c82333 100%)"}; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .summary { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-line; font-family: 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.8; }
    .cost-impact { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .savings { color: #28a745; font-size: 24px; font-weight: 700; }
    .suggestions { background: #e7f3ff; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${isDetailsRequest ? "📊 Cost Details" : result.success ? "✓ Success" : "✗ Failed"}</h1>
    </div>
    <div class="content">
      ${
        !isDetailsRequest
          ? `<div class="summary">
        <strong>Command:</strong> ${summary}
      </div>`
          : ""
      }

      <div class="${isDetailsRequest ? "details" : ""}">
        ${result.message.replace(/\n/g, "<br>")}
      </div>

      ${
        result.success && result.costImpact
          ? `
      <div class="cost-impact">
        <h3>Cost Impact</h3>
        <p>Current: $${result.costImpact.currentMonthlyCost.toFixed(2)}/month</p>
        <p>Projected: $${result.costImpact.projectedMonthlyCost.toFixed(2)}/month</p>
        <p class="savings">Monthly Savings: $${result.costImpact.monthlySavings.toFixed(2)}</p>
      </div>
      `
          : ""
      }

      ${
        !result.success && result.error
          ? `<p style="color: #dc3545;"><strong>Error:</strong> ${result.error}</p>`
          : ""
      }

      ${
        isDetailsRequest
          ? `
      <div class="suggestions">
        <strong>What would you like to do?</strong><br><br>
        Reply to this email with commands like:<br>
        • "Stop the development server"<br>
        • "Approve recommendation #1"<br>
        • "Show me RDS details"
      </div>
      `
          : ""
      }
    </div>
  </div>
</body>
</html>`;

      await this.agentMailClient.replyToMessage(
        context.messageId,
        text,
        html
      );
    } catch (error) {
      console.error(
        `Failed to send result email: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send error email
   */
  private async sendErrorEmail(
    context: EmailCommandContext,
    errorMessage: string
  ): Promise<void> {
    try {
      const text = `Error Processing Command

We encountered an error while processing your command:

${errorMessage}

Please try again or contact support if the issue persists.

Original command: "${context.bodyText.trim()}"`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .error { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
    .command { background: white; padding: 15px; font-family: monospace; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Error Processing Command</h1>
    </div>
    <div class="content">
      <div class="error">
        <strong>Error:</strong><br>
        ${errorMessage}
      </div>

      <div class="command">
        <strong>Original command:</strong><br>
        "${context.bodyText.trim()}"
      </div>

      <p>Please try again or contact support if the issue persists.</p>
    </div>
  </div>
</body>
</html>`;

      await this.agentMailClient.replyToMessage(
        context.messageId,
        text,
        html
      );
    } catch (error) {
      console.error(
        `Failed to send error email: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Log command for debugging
   */
  private logCommand(
    command: ParsedEmailCommand,
    context: EmailCommandContext
  ): void {
    if (this.demoMode) {
      console.log("\n[COMMAND PROCESSOR] Received command:");
      console.log(`  From: ${context.from}`);
      console.log(`  Thread: ${context.threadId}`);
      console.log(`  Raw: "${command.rawCommand}"`);
      console.log(`  Intent: ${command.intent}`);
      console.log(`  Confidence: ${(command.confidence * 100).toFixed(1)}%`);
      console.log(
        `  Resource: ${command.resourceType || "N/A"} ${command.resourceId || ""}`
      );
      console.log(`  Requires Confirmation: ${command.requiresConfirmation}`);
      console.log("");
    }
  }

  /**
   * Get email monitor instance
   */
  getEmailMonitor(): EmailMonitorService {
    return this.emailMonitor;
  }

  /**
   * Get action executor instance
   */
  getActionExecutor(): ActionExecutorService {
    return this.actionExecutor;
  }

  /**
   * Get confirmation handler instance
   */
  getConfirmationHandler(): ConfirmationHandler {
    return this.confirmationHandler;
  }
}

/**
 * Create a new command processor
 */
export function createCommandProcessor(
  agentMailClient?: AgentMailClient,
  emailMonitor?: EmailMonitorService,
  actionExecutor?: ActionExecutorService,
  confirmationHandler?: ConfirmationHandler,
  demoMode: boolean = false
): CommandProcessor {
  return new CommandProcessor(
    agentMailClient,
    emailMonitor,
    actionExecutor,
    confirmationHandler,
    demoMode
  );
}
