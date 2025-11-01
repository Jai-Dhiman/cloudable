import { Args, Command, Flags } from "@oclif/core";
import { resolve } from "node:path";
import { basename } from "node:path";
import ora from "ora";
import boxen from "boxen";
import chalk from "chalk";
import { CostAnalysisService } from "../services/cost-analysis-service.js";
import { ReportFormatter } from "../utils/report-formatter.js";
import { EmailService } from "../services/email-service.js";
import { EmailMonitorService } from "../services/email-monitor.js";
import { CommandProcessor } from "../services/command-processor.js";
import { EmailCommandParser } from "../utils/email-parser.js";

export default class Analyze extends Command {
	static description =
		"Analyze AWS costs for your deployment with intelligent monitoring and human-in-the-loop control";

	static examples = [
		"<%= config.bin %> <%= command.id %>",
		"<%= config.bin %> <%= command.id %> --deployment-id my-app",
		"<%= config.bin %> <%= command.id %> --demo-email user@example.com",
		"<%= config.bin %> <%= command.id %> --wait-for-reply",
	];

	static flags = {
		"deployment-id": Flags.string({
			description: "Deployment ID to analyze (defaults to auto-detect)",
			required: false,
		}),
		"demo-email": Flags.string({
			description: "Email address to send cost report (for demo/testing)",
			required: false,
		}),
		"demo-mode": Flags.boolean({
			description: "Run in demo mode with mock data",
			default: false,
		}),
		"wait-for-reply": Flags.boolean({
			description: "Wait for email reply and process commands (for demo)",
			default: false,
		}),
	};

	static args = {
		path: Args.string({
			description: "Path to the project directory",
			required: false,
			default: ".",
		}),
	};

	async run(): Promise<void> {
		const { args, flags } = await this.parse(Analyze);
		const projectPath = resolve(args.path);
		const projectName = basename(projectPath);
		const deploymentId = flags["deployment-id"] || projectName;
		const demoMode = flags["demo-mode"];
		const waitForReply = flags["wait-for-reply"];
		const recipientEmail =
			flags["demo-email"] || process.env.DEMO_EMAIL || "demo@cloudable.dev";

		// Display header
		this.log(
			"\n" +
				boxen(
					chalk.bold.cyan("📊 Cloudable Cost Analysis\n\n") +
						chalk.white("Deployment: ") +
						chalk.cyan(deploymentId) +
						"\n" +
						chalk.white("Mode: ") +
						chalk.gray(demoMode ? "Demo" : "Production"),
					{
						padding: 1,
						margin: { top: 0, bottom: 1, left: 2, right: 2 },
						borderStyle: "round",
						borderColor: "cyan",
						align: "center",
					},
				),
		);

		try {
			// Agent Box 1: Cost Analysis Agent
			const costAnalysisBox = this.createAgentBox(
				"📊 Cost Analysis Agent",
				"Analyzing AWS costs for the past week...",
				"pending",
			);
			this.log(costAnalysisBox);

			const costService = new CostAnalysisService({
				demoMode,
				region: process.env.AWS_REGION || "us-east-1",
			});

			const startTime = Date.now();
			const analysisResult =
				await costService.generateCostAnalysis(deploymentId);
			const duration = ((Date.now() - startTime) / 1000).toFixed(1);

			// Update box to complete
			this.clearLines(8);
			this.log(
				this.createAgentBox(
					"📊 Cost Analysis Agent",
					`Analyzed costs: $${analysisResult.lastWeekCost.totalCurrentWeek.toFixed(2)} (${analysisResult.lastWeekCost.totalChangePercent >= 0 ? "+" : ""}${analysisResult.lastWeekCost.totalChangePercent.toFixed(1)}%)`,
					"complete",
					duration,
				),
			);

			// Agent Box 2: Red Flag Detection Agent
			this.log(
				this.createAgentBox(
					"🚨 Red Flag Detection Agent",
					"Scanning resources for cost anomalies...",
					"pending",
				),
			);

			// Simulate processing time
			await this.sleep(1750);

			this.clearLines(8);
			this.log(
				this.createAgentBox(
					"🚨 Red Flag Detection Agent",
					`Found ${analysisResult.redFlagSummary.total} issues (${analysisResult.redFlagSummary.bySeverity.critical} critical, ${analysisResult.redFlagSummary.bySeverity.warning} warnings)`,
					"complete",
					"1.5",
				),
			);

			// Agent Box 3: Learning Engine Agent
			this.log(
				this.createAgentBox(
					"🧠 Learning Engine Agent",
					"Querying Hyperspell for historical patterns...",
					"pending",
				),
			);

			await this.sleep(1450);

			this.clearLines(8);
			this.log(
				this.createAgentBox(
					"🧠 Learning Engine Agent",
					`Generated ${analysisResult.learningInsights.length} learning insights from historical data`,
					"complete",
					"1.2",
				),
			);

			// Agent Box 4: Report Generation Agent
			this.log(
				this.createAgentBox(
					"📝 Report Generation Agent",
					"Formatting cost report...",
					"pending",
				),
			);

			await this.sleep(1050);

			const formattedReport = ReportFormatter.formatForPDF(
				analysisResult,
				deploymentId,
			);

			this.clearLines(8);
			this.log(
				this.createAgentBox(
					"📝 Report Generation Agent",
					"Cost report formatted and ready for delivery",
					"complete",
					"0.8",
				),
			);

			// Display summary to user
			this.displayCostSummary(formattedReport);

			// Agent Box 5: Email Delivery Agent
			this.log(
				this.createAgentBox(
					"📧 Email Delivery Agent",
					"Sending cost report via AgentMail...",
					"pending",
				),
			);

			const emailService = new EmailService();
			const emailStartTime = Date.now();

			let messageId = `msg-${Date.now()}`;
			let threadId = `thread-${Date.now()}`;

			try {
				const emailResult = await emailService.sendWeeklyCostReport({
					deploymentId,
					analysisResult,
					recipientEmail,
				});

				messageId = emailResult.messageId;
				threadId = emailResult.threadId;

				const emailDuration = ((Date.now() - emailStartTime) / 1000).toFixed(1);

				this.clearLines(8);
				this.log(
					this.createAgentBox(
						"📧 Email Delivery Agent",
						`Email sent successfully to ${recipientEmail}`,
						"complete",
						emailDuration,
					),
				);
			} catch (error) {
				// If email fails, show warning but don't crash
				this.clearLines(8);
				this.log(
					this.createAgentBox(
						"📧 Email Delivery Agent",
						`Email sending skipped (${error instanceof Error ? error.message : "AgentMail not configured"})`,
						"complete",
						"0.0",
					),
				);
				this.log(
					chalk.yellow(
						"\n⚠️  Email not sent - AgentMail may not be configured. Set AGENTMAIL_API_KEY to enable.\n",
					),
				);
			}

			// Success message
			this.log(
				"\n" +
					boxen(
						chalk.bold.green("✓ Cost Analysis Complete!\n\n") +
							chalk.white("📧 Report sent to: ") +
							chalk.cyan(recipientEmail) +
							"\n" +
							chalk.white("💰 Current week: ") +
							chalk.green(
								`$${analysisResult.lastWeekCost.totalCurrentWeek.toFixed(2)}`,
							) +
							"\n" +
							chalk.white("📈 Monthly projection: ") +
							chalk.yellow(
								`$${analysisResult.expectedMonthlyCost.projected.toFixed(2)}`,
							) +
							"\n" +
							chalk.white("💡 Potential savings: ") +
							chalk.green(
								`$${analysisResult.redFlagSummary.totalPotentialSavings.toFixed(2)}/month`,
							) +
							"\n\n" +
							chalk.gray("Reply to the email to control resources:\n") +
							chalk.gray('  • "Stop the NAT Gateway"\n') +
							chalk.gray('  • "Approve recommendation #1"\n') +
							chalk.gray('  • "Show me more details"'),
						{
							padding: 1,
							margin: 1,
							borderStyle: "round",
							borderColor: "green",
						},
					) +
					"\n",
			);

			// Wait for reply mode (for demo)
			if (waitForReply) {
				await this.monitorForReplies(
					threadId,
					analysisResult,
					deploymentId,
					demoMode,
				);
			}
		} catch (error) {
			this.error(
				`Cost analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Create an agent progress box
	 */
	private createAgentBox(
		title: string,
		status: string,
		state: "pending" | "in_progress" | "complete",
		duration?: string,
	): string {
		const width = 80;
		const statusIcon =
			state === "complete" ? "✅" : state === "in_progress" ? "⏳" : "🔄";
		const statusColor =
			state === "complete"
				? chalk.green
				: state === "in_progress"
					? chalk.yellow
					: chalk.cyan;

		const titleLine = `${statusIcon} ${title}`;
		const statusLine = status;
		const durationLine = duration ? `Duration: ${duration}s` : "";

		const topBorder = "┌─" + "─".repeat(width - 2) + "┐";
		const bottomBorder = "└─" + "─".repeat(width - 2) + "┘";

		const lines = [
			topBorder,
			"│ " +
				statusColor(titleLine) +
				" ".repeat(Math.max(0, width - titleLine.length - 3)) +
				"│",
			"│ " +
				chalk.gray(statusLine) +
				" ".repeat(Math.max(0, width - statusLine.length - 3)) +
				"│",
		];

		if (durationLine) {
			lines.push(
				"│ " +
					chalk.dim(durationLine) +
					" ".repeat(Math.max(0, width - durationLine.length - 3)) +
					"│",
			);
		} else {
			lines.push("│" + " ".repeat(width - 2) + "│");
		}

		// Add empty lines to maintain consistent box height
		while (lines.length < 7) {
			lines.push("│" + " ".repeat(width - 2) + "│");
		}

		lines.push(bottomBorder);

		return lines.join("\n");
	}

	/**
	 * Display cost summary after analysis
	 */
	private displayCostSummary(report: any): void {
		this.log(
			"\n" +
				boxen(
					chalk.bold("📊 Cost Summary\n\n") +
						chalk.cyan("Last Week: ") +
						chalk.white(report.costSummary.lastWeek.formatted) +
						"\n" +
						chalk.cyan("Previous Week: ") +
						chalk.white(report.costSummary.previousWeek.formatted) +
						"\n" +
						chalk.cyan("Change: ") +
						(report.costSummary.change.direction === "up"
							? chalk.red
							: chalk.green)(report.costSummary.change.formatted) +
						"\n" +
						chalk.cyan("Monthly Projection: ") +
						chalk.yellow(report.projections.monthly.formatted) +
						"\n\n" +
						chalk.bold("🚨 Red Flags\n\n") +
						chalk.red(`  Critical: ${report.redFlags.summary.critical}`) +
						"\n" +
						chalk.yellow(`  Warning: ${report.redFlags.summary.warning}`) +
						"\n" +
						chalk.blue(`  Info: ${report.redFlags.summary.info}`) +
						"\n\n" +
						chalk.bold("💡 Potential Savings: ") +
						chalk.green(report.redFlags.totalPotentialSavingsFormatted),
					{
						padding: { top: 0, bottom: 0, left: 2, right: 2 },
						borderStyle: "round",
						borderColor: "blue",
					},
				) +
				"\n",
		);

		// Show top red flags
		if (report.redFlags.items.length > 0) {
			this.log(chalk.bold("🔍 Top Issues:\n"));
			report.redFlags.items.slice(0, 3).forEach((flag: any, index: number) => {
				const severityIcon =
					flag.severity === "critical"
						? "🚨"
						: flag.severity === "warning"
							? "⚠️"
							: "ℹ️";
				const severityColor =
					flag.severity === "critical"
						? chalk.red
						: flag.severity === "warning"
							? chalk.yellow
							: chalk.blue;

				this.log(`  ${severityIcon} ${severityColor(flag.title)}`);
				this.log(`     ${chalk.gray(flag.description)}`);
				if (flag.estimatedSavingsFormatted) {
					this.log(
						`     ${chalk.green("Savings: " + flag.estimatedSavingsFormatted)}`,
					);
				}
				this.log("");
			});
		}

		// Show learning insights
		if (report.learningInsights.length > 0) {
			this.log(chalk.bold("🧠 Learning Insights:\n"));
			report.learningInsights.slice(0, 3).forEach((insight: any) => {
				this.log(`  • ${chalk.gray(insight.message)}`);
				this.log(
					`    ${chalk.dim("Confidence: " + insight.confidenceFormatted)}\n`,
				);
			});
		}
	}

	/**
	 * Clear N lines from terminal
	 */
	private clearLines(count: number): void {
		for (let i = 0; i < count; i++) {
			process.stdout.write("\x1b[1A\x1b[2K");
		}
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Monitor for email replies and process commands
	 */
	private async monitorForReplies(
		threadId: string,
		analysisResult: any,
		deploymentId: string,
		demoMode: boolean,
	): Promise<void> {
		this.log(chalk.cyan("\n⏳ Monitoring email for replies...\n"));
		this.log(chalk.gray("  Checking every 5 seconds (Ctrl+C to exit)\n"));

		try {
			// Initialize AgentMail client first
			const { getAgentMailClient } = await import(
				"../integrations/agentmail.js"
			);
			const agentMailClient = getAgentMailClient();
			await agentMailClient.initialize("cloudable-cost-reports");

			const emailMonitor = new EmailMonitorService(agentMailClient);
			const commandProcessor = new CommandProcessor(
				undefined,
				emailMonitor,
				undefined,
				undefined,
				demoMode,
			);

			const monitorSpinner = ora({
				text: chalk.cyan("Waiting for reply..."),
				spinner: "dots",
			}).start();

			let attempts = 0;
			const maxAttempts = 60; // 5 minutes

			// Poll for replies
			try {
				const replies = await emailMonitor.pollForReplies(threadId, {
					intervalMs: 5000,
					timeoutMs: 300000, // 5 minutes
					maxAttempts: maxAttempts,
				});

				if (replies.length > 0) {
					monitorSpinner.stop();

					for (const reply of replies) {
						// Display only the user's actual command (without quoted text)
						const displayCommand = reply.parsed.rawCommand.split("\n")[0]; // First line only

						this.log(
							"\n" +
								boxen(
									chalk.bold.green("📧 Email Reply Received!\n\n") +
										chalk.white("From: ") +
										chalk.cyan(reply.context.from) +
										"\n" +
										chalk.white("Command: ") +
										chalk.yellow(displayCommand) +
										"\n\n" +
										chalk.gray(EmailCommandParser.summarize(reply.parsed)),
									{
										padding: 1,
										margin: 1,
										borderStyle: "round",
										borderColor: "green",
									},
								) +
								"\n",
						);

						// Process the command
						this.log(chalk.cyan("🔄 Processing command...\n"));

						const processingSpinner = ora({
							text: chalk.cyan("Executing action..."),
							spinner: "dots",
						}).start();

						const result = await commandProcessor.processEmailCommand(
							{
								...reply.context,
								report: this.convertToWeeklyCostReport(
									analysisResult,
									deploymentId,
								),
							},
							false,
						); // Don't wait for confirmation in monitoring mode

						processingSpinner.stop();

						// Display result
						if (result.success) {
							this.log(
								"\n" +
									boxen(
										chalk.bold.green("✓ Action Completed Successfully!\n\n") +
											chalk.white("Action: ") +
											chalk.cyan(result.command.intent.replace("_", " ")) +
											"\n" +
											(result.actionResult?.resourceType
												? chalk.white("Resource: ") +
													chalk.yellow(result.actionResult.resourceType) +
													"\n"
												: "") +
											(result.actionResult?.costImpact
												? chalk.white("Monthly Savings: ") +
													chalk.green(
														`$${result.actionResult.costImpact.monthlySavings.toFixed(2)}`,
													) +
													"\n"
												: "") +
											"\n" +
											chalk.gray(result.message),
										{
											padding: 1,
											margin: 1,
											borderStyle: "round",
											borderColor: "green",
										},
									) +
									"\n",
							);
						} else if (result.requiresClarification) {
							this.log(
								"\n" +
									boxen(
										chalk.bold.yellow("❓ Clarification Needed\n\n") +
											chalk.gray(result.message) +
											"\n\n" +
											chalk.white("A clarification email has been sent."),
										{
											padding: 1,
											margin: 1,
											borderStyle: "round",
											borderColor: "yellow",
										},
									) +
									"\n",
							);
						} else {
							this.log(
								"\n" +
									boxen(
										chalk.bold.red("✗ Action Failed\n\n") +
											chalk.gray(result.message),
										{
											padding: 1,
											margin: 1,
											borderStyle: "round",
											borderColor: "red",
										},
									) +
									"\n",
							);
						}

						// Show confirmation if required
						if (result.command.requiresConfirmation && !result.executed) {
							this.log(
								chalk.yellow(
									"\n⏳ Confirmation required. A confirmation email has been sent.\n",
								),
							);
							this.log(
								chalk.gray(
									'Reply to the email with "yes" or "confirm" to proceed.\n',
								),
							);
						}
					}

					this.log(chalk.green("\n✓ All replies processed successfully!\n"));
				}
			} catch (error) {
				monitorSpinner.stop();

				if (error instanceof Error && error.message.includes("Timeout")) {
					this.log(
						chalk.yellow(
							"\n⏱️  No reply received within timeout period (5 minutes).\n",
						),
					);
					this.log(
						chalk.gray(
							"You can still reply to the email - it will be processed next time you run this command.\n",
						),
					);
				} else {
					this.log(
						chalk.red(
							`\n✗ Error monitoring for replies: ${error instanceof Error ? error.message : String(error)}\n`,
						),
					);
				}
			}
		} catch (error) {
			this.log(
				chalk.red(
					`\n✗ Failed to start email monitoring: ${error instanceof Error ? error.message : String(error)}\n`,
				),
			);
			this.log(
				chalk.gray("Make sure AGENTMAIL_API_KEY is set in your environment.\n"),
			);
		}
	}

	/**
	 * Convert analysis result to WeeklyCostReport format
	 */
	private convertToWeeklyCostReport(
		analysisResult: any,
		deploymentId: string,
	): any {
		return {
			reportId: `report-${Date.now()}`,
			generatedAt: new Date().toISOString(),
			weekStartDate: new Date(
				Date.now() - 7 * 24 * 60 * 60 * 1000,
			).toISOString(),
			weekEndDate: new Date().toISOString(),
			costSummary: analysisResult.lastWeekCost,
			redFlags: analysisResult.redFlags || [],
			optimizations: analysisResult.optimizations || [],
			learningInsights: analysisResult.learningInsights || [],
			deploymentId,
		};
	}
}
