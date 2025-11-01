/**
 * Email Service
 * Handles sending cost reports and managing email communication via AgentMail
 */

import { AgentMailClient } from "../integrations/agentmail.js";
import { ReportFormatter } from "../utils/report-formatter.js";
import type { CostAnalysisResult } from "./cost-analysis-service.js";

export interface EmailSendResult {
	messageId: string;
	threadId: string;
	recipientEmail: string;
	subject: string;
	sentAt: string;
}

export interface WeeklyCostReportEmail {
	deploymentId: string;
	analysisResult: CostAnalysisResult;
	recipientEmail: string;
}

export class EmailService {
	private agentMailClient: AgentMailClient;
	private initialized: boolean = false;

	constructor(apiKey?: string) {
		this.agentMailClient = new AgentMailClient(apiKey);
	}

	/**
	 * Initialize the email service
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		await this.agentMailClient.initialize("cloudable-cost-reports");
		this.initialized = true;
	}

	/**
	 * Send weekly cost report email
	 */
	async sendWeeklyCostReport(
		report: WeeklyCostReportEmail,
	): Promise<EmailSendResult> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			// Format report as HTML email
			const htmlContent = ReportFormatter.formatForEmail(
				report.analysisResult,
				report.deploymentId,
			);

			// Generate subject line
			const subject = this.generateSubject(report.analysisResult);

			// Generate plain text fallback
			const plainText = this.generatePlainText(report.analysisResult);

			// Send email via AgentMail
			const message = await this.agentMailClient.sendEmail(
				report.recipientEmail,
				subject,
				plainText,
				htmlContent,
				{
					labels: ["cost-report", "weekly", report.deploymentId],
				},
			);

			const result: EmailSendResult = {
				messageId: (message as any).messageId || `msg-${Date.now()}`,
				threadId: (message as any).threadId || `thread-${Date.now()}`,
				recipientEmail: report.recipientEmail,
				subject,
				sentAt: new Date().toISOString(),
			};

			// Log for tracking
			console.log("[EmailService] Cost report sent:", {
				messageId: result.messageId,
				threadId: result.threadId,
				recipient: result.recipientEmail,
				deploymentId: report.deploymentId,
			});

			return result;
		} catch (error) {
			throw new Error(
				`Failed to send cost report email: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Send a reply to an existing email thread
	 */
	async sendReply(
		messageId: string,
		replyText: string,
		replyHtml?: string,
	): Promise<EmailSendResult> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const reply = await this.agentMailClient.replyToMessage(
				messageId,
				replyText,
				replyHtml,
			);

			return {
				messageId: (reply as any).messageId || `msg-${Date.now()}`,
				threadId: (reply as any).threadId || `thread-${Date.now()}`,
				recipientEmail: "unknown",
				subject: "Re: Cost Report",
				sentAt: new Date().toISOString(),
			};
		} catch (error) {
			throw new Error(
				`Failed to send reply: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get inbox messages
	 */
	async getMessages(options?: {
		labels?: string[];
		limit?: number;
	}): Promise<any[]> {
		if (!this.initialized) {
			await this.initialize();
		}

		return await this.agentMailClient.listMessages(undefined, options);
	}

	/**
	 * Generate email subject line
	 */
	private generateSubject(result: CostAnalysisResult): string {
		const cost = result.lastWeekCost.totalCurrentWeek.toFixed(2);
		const change = result.lastWeekCost.totalChangePercent;
		const trend = change > 0 ? "↑" : change < 0 ? "↓" : "→";

		if (result.redFlagSummary.bySeverity.critical > 0) {
			return `Cloudable Cost Alert: $${cost} ${trend} ${Math.abs(change).toFixed(1)}% - ${result.redFlagSummary.bySeverity.critical} Critical Issue${result.redFlagSummary.bySeverity.critical > 1 ? "s" : ""}`;
		}

		if (Math.abs(change) > 20) {
			return `Cloudable Cost Report: $${cost} ${trend} ${Math.abs(change).toFixed(1)}% (Significant Change)`;
		}

		return `Cloudable Weekly Cost Report: $${cost} ${trend} ${Math.abs(change).toFixed(1)}%`;
	}

	/**
	 * Generate plain text version of the email
	 */
	private generatePlainText(result: CostAnalysisResult): string {
		const lines: string[] = [];

		lines.push("CLOUDABLE WEEKLY COST REPORT");
		lines.push("=".repeat(50));
		lines.push("");

		// Cost Summary
		lines.push("COST SUMMARY");
		lines.push(
			`Current Week: $${result.lastWeekCost.totalCurrentWeek.toFixed(2)}`,
		);
		lines.push(
			`Previous Week: $${result.lastWeekCost.totalPreviousWeek.toFixed(2)}`,
		);
		lines.push(
			`Change: ${result.lastWeekCost.totalChangePercent >= 0 ? "+" : ""}${result.lastWeekCost.totalChangePercent.toFixed(1)}%`,
		);
		lines.push(
			`Monthly Projection: $${result.expectedMonthlyCost.projected.toFixed(2)}`,
		);
		lines.push("");

		// Red Flags
		if (result.redFlagSummary.total > 0) {
			lines.push(`RED FLAGS: ${result.redFlagSummary.total}`);
			lines.push(`  Critical: ${result.redFlagSummary.bySeverity.critical}`);
			lines.push(`  Warning: ${result.redFlagSummary.bySeverity.warning}`);
			lines.push(`  Info: ${result.redFlagSummary.bySeverity.info}`);
			lines.push("");

			if (result.redFlagSummary.totalPotentialSavings > 0) {
				lines.push(
					`Potential Savings: $${result.redFlagSummary.totalPotentialSavings.toFixed(2)}/month`,
				);
				lines.push("");
			}
		}

		// Top Issues
		if (result.redFlags.length > 0) {
			lines.push("TOP ISSUES:");
			result.redFlags.slice(0, 3).forEach((flag, index) => {
				lines.push(
					`  ${index + 1}. [${flag.severity.toUpperCase()}] ${flag.title}`,
				);
				lines.push(`     ${flag.description}`);
				if (flag.estimatedSavings) {
					lines.push(
						`     Savings: $${flag.estimatedSavings.toFixed(2)}/month`,
					);
				}
				lines.push("");
			});
		}

		// Learning Insights
		if (result.learningInsights.length > 0) {
			lines.push("LEARNING INSIGHTS:");
			result.learningInsights.forEach((insight) => {
				lines.push(`  • ${insight.message}`);
			});
			lines.push("");
		}

		lines.push("");
		lines.push("REPLY TO THIS EMAIL TO TAKE ACTION");
		lines.push("Example commands:");
		lines.push('  - "Stop the NAT Gateway"');
		lines.push('  - "Approve recommendation #1"');
		lines.push('  - "Show me more details"');
		lines.push("");
		lines.push("--");
		lines.push("Powered by Cloudable");
		lines.push("AgentMail + Hyperspell + Mastra + Moss");

		return lines.join("\n");
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}
			return await this.agentMailClient.healthCheck();
		} catch {
			return false;
		}
	}
}

// Export singleton instance
let emailServiceInstance: EmailService | null = null;

export function getEmailService(): EmailService {
	if (!emailServiceInstance) {
		emailServiceInstance = new EmailService();
	}
	return emailServiceInstance;
}

export function resetEmailService(): void {
	emailServiceInstance = null;
}
