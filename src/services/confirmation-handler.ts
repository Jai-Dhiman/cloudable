/**
 * Confirmation Workflow Handler
 * Manages multi-step confirmations for destructive actions
 */

import { AgentMailClient, getAgentMailClient } from "../integrations/agentmail.js";
import { EmailMonitorService } from "./email-monitor.js";
import { ActionExecutorService } from "./action-executor.js";
import { EmailCommandParser } from "../utils/email-parser.js";
import type {
  ParsedEmailCommand,
  ConfirmationWorkflow,
  ApprovalRequest,
  EmailCommandContext,
} from "../types/cost-monitor.js";
import type { ActionResult, ExecutionContext } from "./action-executor.js";

export interface ConfirmationResult {
  confirmed: boolean;
  executed: boolean;
  actionResult?: ActionResult;
  message: string;
  workflow: ConfirmationWorkflow;
}

/**
 * Confirmation Handler
 * Handles multi-step confirmation workflows for destructive actions
 */
export class ConfirmationHandler {
  private agentMailClient: AgentMailClient;
  private emailMonitor: EmailMonitorService;
  private actionExecutor: ActionExecutorService;
  private pendingConfirmations: Map<string, ApprovalRequest>;

  constructor(
    agentMailClient?: AgentMailClient,
    emailMonitor?: EmailMonitorService,
    actionExecutor?: ActionExecutorService
  ) {
    this.agentMailClient = agentMailClient || getAgentMailClient();
    this.emailMonitor = emailMonitor || new EmailMonitorService(this.agentMailClient);
    this.actionExecutor = actionExecutor || new ActionExecutorService(undefined, true);
    this.pendingConfirmations = new Map();
  }

  /**
   * Handle command with confirmation workflow
   * Returns confirmation result after user confirms or rejects
   */
  async handleCommandWithConfirmation(
    command: ParsedEmailCommand,
    context: EmailCommandContext & ExecutionContext,
    waitForConfirmation: boolean = true
  ): Promise<ConfirmationResult> {
    // Check if command requires confirmation
    if (!command.requiresConfirmation) {
      // Execute immediately
      const actionResult = await this.actionExecutor.executeCommand(command, context);

      return {
        confirmed: true,
        executed: true,
        actionResult,
        message: "Action executed without confirmation (non-destructive)",
        workflow: this.createWorkflow(command, context, "completed"),
      };
    }

    // Create approval request
    const approvalRequest = this.createApprovalRequest(command, context);
    this.pendingConfirmations.set(approvalRequest.id, approvalRequest);

    // Send confirmation email
    const confirmationEmail = this.generateConfirmationEmail(
      command,
      approvalRequest
    );

    await this.agentMailClient.replyToMessage(
      context.messageId,
      confirmationEmail.text,
      confirmationEmail.html
    );

    if (!waitForConfirmation) {
      // Return pending state without waiting
      return {
        confirmed: false,
        executed: false,
        message: "Confirmation email sent. Waiting for user response.",
        workflow: this.createWorkflow(command, context, "awaiting_confirmation"),
      };
    }

    // Wait for confirmation reply
    try {
      const reply = await this.emailMonitor.waitForIntent(
        context.threadId,
        ["confirm_action", "cancel_action"],
        { timeoutMs: 300000, maxAttempts: 60 } // 5 minute timeout
      );

      if (reply.parsed.intent === "confirm_action") {
        // Execute the action
        const actionResult = await this.actionExecutor.executeCommand(
          command,
          context
        );

        // Send result email
        await this.sendResultEmail(
          context.threadId,
          actionResult,
          command
        );

        // Cleanup
        this.pendingConfirmations.delete(approvalRequest.id);

        return {
          confirmed: true,
          executed: true,
          actionResult,
          message: "Action confirmed and executed",
          workflow: this.createWorkflow(command, context, "completed"),
        };
      } else {
        // User cancelled
        await this.sendCancellationEmail(context.threadId, command);

        this.pendingConfirmations.delete(approvalRequest.id);

        return {
          confirmed: false,
          executed: false,
          message: "Action cancelled by user",
          workflow: this.createWorkflow(command, context, "cancelled"),
        };
      }
    } catch (error) {
      // Timeout or error
      this.pendingConfirmations.delete(approvalRequest.id);

      return {
        confirmed: false,
        executed: false,
        message: `Confirmation timeout: ${error instanceof Error ? error.message : String(error)}`,
        workflow: this.createWorkflow(command, context, "cancelled"),
      };
    }
  }

  /**
   * Create an approval request from a parsed command
   */
  private createApprovalRequest(
    command: ParsedEmailCommand,
    context: EmailCommandContext
  ): ApprovalRequest {
    const id = `approval-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    // Estimate cost impact based on command
    const costImpact = this.estimateCostImpact(command);

    return {
      id,
      timestamp: new Date().toISOString(),
      action: this.mapIntentToAction(command.intent),
      resourceId: command.resourceId || "unknown",
      resourceType: command.resourceType || "unknown",
      description: command.rawCommand,
      costImpact,
      risks: this.identifyRisks(command),
      reversible: this.isReversible(command),
      requiresConfirmation: true,
      status: "pending",
      expiresAt,
    };
  }

  /**
   * Create a confirmation workflow record
   */
  private createWorkflow(
    command: ParsedEmailCommand,
    context: EmailCommandContext,
    step: ConfirmationWorkflow["step"]
  ): ConfirmationWorkflow {
    return {
      approvalRequestId: `approval-${Date.now()}`,
      step,
      userEmail: context.from,
      conversationThreadId: context.threadId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        attempts: 1,
      },
    };
  }

  /**
   * Generate confirmation email content
   */
  private generateConfirmationEmail(
    command: ParsedEmailCommand,
    approval: ApprovalRequest
  ): { text: string; html: string } {
    const actionDescription = this.getActionDescription(command);
    const savingsText =
      approval.costImpact.monthlySavings > 0
        ? `This will save approximately $${approval.costImpact.monthlySavings.toFixed(2)}/month.`
        : "";

    const risksText =
      approval.risks.length > 0
        ? `\n\nRisks:\n${approval.risks.map((r) => `- ${r}`).join("\n")}`
        : "";

    const reversibleText = approval.reversible
      ? "\n\nThis action is reversible."
      : "\n\nWARNING: This action is NOT reversible.";

    const text = `Confirmation Required

${actionDescription}

${savingsText}${risksText}${reversibleText}

To confirm this action, reply with "yes" or "confirm".
To cancel, reply with "no" or "cancel".

This confirmation request will expire in 1 hour.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .success { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; }
    .risk-list { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; border-radius: 6px; text-decoration: none; font-weight: 600; }
    .button-confirm { background: #28a745; color: white; }
    .button-cancel { background: #dc3545; color: white; }
    .footer { text-align: center; color: #6c757d; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Confirmation Required</h1>
    </div>
    <div class="content">
      <p><strong>${actionDescription}</strong></p>

      ${savingsText ? `<div class="success"><strong>Cost Impact:</strong> ${savingsText}</div>` : ""}

      ${
        approval.risks.length > 0
          ? `
      <div class="warning">
        <strong>Risks:</strong>
        <ul style="margin: 10px 0 0 0;">
          ${approval.risks.map((r) => `<li>${r}</li>`).join("")}
        </ul>
      </div>
      `
          : ""
      }

      ${
        approval.reversible
          ? '<p style="color: #28a745;"><strong>✓ This action is reversible</strong></p>'
          : '<p style="color: #dc3545;"><strong>⚠ WARNING: This action is NOT reversible</strong></p>'
      }

      <div style="text-align: center; margin: 30px 0;">
        <p><strong>To confirm this action, reply with "yes" or "confirm".</strong></p>
        <p>To cancel, reply with "no" or "cancel".</p>
      </div>

      <div class="footer">
        <p>This confirmation request will expire in 1 hour.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    return { text, html };
  }

  /**
   * Send result email after action execution
   */
  private async sendResultEmail(
    threadId: string,
    result: ActionResult,
    command: ParsedEmailCommand
  ): Promise<void> {
    const text = result.success
      ? `Action Completed Successfully

${result.message}

${result.costImpact ? `Cost Impact:\n- Current: $${result.costImpact.currentMonthlyCost.toFixed(2)}/month\n- Projected: $${result.costImpact.projectedMonthlyCost.toFixed(2)}/month\n- Savings: $${result.costImpact.monthlySavings.toFixed(2)}/month` : ""}

The action has been executed and your AWS resources have been updated.`
      : `Action Failed

${result.message}

${result.error ? `Error: ${result.error}` : ""}

Please check your AWS console or contact support if you need assistance.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${result.success ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)" : "linear-gradient(135deg, #dc3545 0%, #c82333 100%)"}; color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .cost-impact { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .savings { color: #28a745; font-size: 24px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">${result.success ? "✓ Action Completed" : "✗ Action Failed"}</h1>
    </div>
    <div class="content">
      <p><strong>${result.message}</strong></p>

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

      <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
        ${result.success ? "The action has been executed and your AWS resources have been updated." : "Please check your AWS console or contact support if you need assistance."}
      </p>
    </div>
  </div>
</body>
</html>`;

    // Get messages to find the right one to reply to
    const messages = await this.agentMailClient.listMessages(undefined, {
      limit: 10,
    });

    const threadMessage = messages.find((msg: any) => msg.threadId === threadId);

    if (threadMessage) {
      await this.agentMailClient.replyToMessage(
        threadMessage.messageId,
        text,
        html
      );
    }
  }

  /**
   * Send cancellation email
   */
  private async sendCancellationEmail(
    threadId: string,
    command: ParsedEmailCommand
  ): Promise<void> {
    const text = `Action Cancelled

Your request to ${this.getActionDescription(command)} has been cancelled.

No changes have been made to your AWS resources.`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6c757d 0%, #495057 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">Action Cancelled</h1>
    </div>
    <div class="content">
      <p>Your request to <strong>${this.getActionDescription(command)}</strong> has been cancelled.</p>
      <p>No changes have been made to your AWS resources.</p>
    </div>
  </div>
</body>
</html>`;

    const messages = await this.agentMailClient.listMessages(undefined, {
      limit: 10,
    });

    const threadMessage = messages.find((msg: any) => msg.threadId === threadId);

    if (threadMessage) {
      await this.agentMailClient.replyToMessage(
        threadMessage.messageId,
        text,
        html
      );
    }
  }

  /**
   * Get action description for user display
   */
  private getActionDescription(command: ParsedEmailCommand): string {
    const resourceStr = command.resourceType
      ? `${command.resourceType}${command.resourceId ? ` (${command.resourceId})` : ""}`
      : command.resourceId || "resource";

    switch (command.intent) {
      case "stop_resource":
        return `stop ${resourceStr}`;
      case "start_resource":
        return `start ${resourceStr}`;
      case "resize_resource":
        return `resize ${resourceStr}`;
      case "approve_recommendation":
        return `approve recommendation #${command.recommendationId}`;
      default:
        return command.rawCommand;
    }
  }

  /**
   * Estimate cost impact of command
   */
  private estimateCostImpact(command: ParsedEmailCommand) {
    // This would query actual AWS cost data in production
    // For now, return estimates based on resource type
    const defaultCosts: Record<string, number> = {
      "NAT Gateway": 32.4,
      EC2: 73.2,
      RDS: 54.5,
      "Load Balancer": 16.2,
      S3: 5.0,
    };

    const currentCost =
      defaultCosts[command.resourceType || ""] || 20.0;

    if (command.intent === "stop_resource") {
      return {
        currentMonthlyCost: currentCost,
        projectedMonthlyCost: 0,
        monthlySavings: currentCost,
      };
    }

    return {
      currentMonthlyCost: currentCost,
      projectedMonthlyCost: currentCost,
      monthlySavings: 0,
    };
  }

  /**
   * Identify risks for action
   */
  private identifyRisks(command: ParsedEmailCommand): string[] {
    const risks: string[] = [];

    if (command.intent === "stop_resource") {
      risks.push("Service will become unavailable");
      if (command.resourceType === "RDS") {
        risks.push("Database connections will be terminated");
      }
      if (command.resourceType === "NAT Gateway") {
        risks.push("Instances in private subnets will lose internet access");
      }
    }

    return risks;
  }

  /**
   * Check if action is reversible
   */
  private isReversible(command: ParsedEmailCommand): boolean {
    // Stop actions are generally reversible (can be restarted)
    if (command.intent === "stop_resource") {
      return command.resourceType !== "NAT Gateway"; // NAT Gateway deletion is not reversible
    }

    return true;
  }

  /**
   * Map email intent to approval action type
   */
  private mapIntentToAction(
    intent: string
  ): ApprovalRequest["action"] {
    switch (intent) {
      case "stop_resource":
        return "stop_resource";
      case "resize_resource":
        return "modify_resource";
      default:
        return "stop_resource";
    }
  }

  /**
   * Get pending confirmation by ID
   */
  getPendingConfirmation(id: string): ApprovalRequest | undefined {
    return this.pendingConfirmations.get(id);
  }

  /**
   * Get all pending confirmations
   */
  getAllPendingConfirmations(): ApprovalRequest[] {
    return Array.from(this.pendingConfirmations.values());
  }
}

/**
 * Create a new confirmation handler
 */
export function createConfirmationHandler(
  agentMailClient?: AgentMailClient,
  emailMonitor?: EmailMonitorService,
  actionExecutor?: ActionExecutorService
): ConfirmationHandler {
  return new ConfirmationHandler(agentMailClient, emailMonitor, actionExecutor);
}
