/**
 * Report Generation Service
 * Orchestrates cost analysis, PDF generation, and email delivery
 */

import { CostAnalysisService } from './cost-analysis-service.js';
import { ReportFormatter } from '../utils/report-formatter.js';
import { PDFGeneratorService } from './pdf-generator.service.js';
import { AgentMailClient } from '../integrations/agentmail.js';
import type { CostAnalysisConfig } from './cost-analysis-service.js';

export interface ReportGenerationConfig extends CostAnalysisConfig {
	recipientEmail?: string;
	generatePDF?: boolean;
	sendEmail?: boolean;
}

export interface ReportGenerationResult {
	reportId: string;
	deploymentId: string;
	pdfPath?: string;
	emailSent: boolean;
	messageId?: string;
	threadId?: string;
	error?: string;
}

export class ReportGenerationService {
	private costAnalysis: CostAnalysisService;
	private agentMail: AgentMailClient;

	constructor(config: ReportGenerationConfig = {}) {
		this.costAnalysis = new CostAnalysisService(config);
		// AgentMailClient gets API key from environment or can be passed
		// We'll let it use the default behavior (from env)
		this.agentMail = new AgentMailClient();
	}

	/**
	 * Generate a complete cost report: analysis + PDF + email
	 */
	async generateAndSendReport(
		deploymentId: string,
		config: ReportGenerationConfig = {},
	): Promise<ReportGenerationResult> {
		try {
			// Step 1: Generate cost analysis
			const analysisResult = await this.costAnalysis.generateCostAnalysis(
				deploymentId,
			);

			// Step 2: Format data for PDF
			const pdfData = ReportFormatter.formatForPDF(analysisResult, deploymentId);

			let pdfPath: string | undefined;
			let pdfBuffer: Buffer | undefined;

			// Step 3: Generate PDF if requested
			if (config.generatePDF !== false) {
				if (config.sendEmail) {
					// Generate as buffer for email attachment
					pdfBuffer = await PDFGeneratorService.generatePDFBuffer(pdfData);
				} else {
					// Generate as file
					pdfPath = await PDFGeneratorService.generatePDF(pdfData);
				}
			}

			// Step 4: Send email if requested and recipient provided
			let emailSent = false;
			let messageId: string | undefined;
			let threadId: string | undefined;

			if (
				config.sendEmail !== false &&
				config.recipientEmail &&
				config.recipientEmail.trim()
			) {
				// Initialize AgentMail if not already done
				try {
					await this.agentMail.initialize();
				} catch (error) {
					console.warn(
						'AgentMail initialization warning:',
						error instanceof Error ? error.message : String(error),
					);
				}

				// Generate HTML template (simple version)
				const htmlTemplate = this.generateHTMLTemplate(pdfData);

				// Convert PDFReportData to WeeklyCostReport format for AgentMail
				const weeklyReport = this.convertToWeeklyReport(analysisResult, pdfData);

				// Send email with PDF attachment
				const emailResult = await this.agentMail.sendCostReport(
					weeklyReport,
					config.recipientEmail,
					htmlTemplate,
					{
						pdfAttachment: pdfBuffer,
						pdfFilename: `cost-report-${pdfData.metadata.reportId}.pdf`,
					},
				);

				emailSent = true;
				messageId = emailResult.messageId;
				threadId = emailResult.threadId;
			}

			return {
				reportId: pdfData.metadata.reportId,
				deploymentId,
				pdfPath,
				emailSent,
				messageId,
				threadId,
			};
		} catch (error) {
			return {
				reportId: `error-${Date.now()}`,
				deploymentId,
				emailSent: false,
				error:
					error instanceof Error ? error.message : String(error),
			};
		}
	}

	/**
	 * Generate PDF only (no email)
	 */
	async generatePDFOnly(
		deploymentId: string,
		outputPath?: string,
		config: ReportGenerationConfig = {},
	): Promise<string> {
		const analysisResult = await this.costAnalysis.generateCostAnalysis(
			deploymentId,
		);
		const pdfData = ReportFormatter.formatForPDF(analysisResult, deploymentId);
		return await PDFGeneratorService.generatePDF(pdfData, outputPath);
	}

	/**
	 * Generate analysis only (no PDF, no email)
	 */
	async generateAnalysisOnly(
		deploymentId: string,
	): Promise<ReturnType<typeof ReportFormatter.formatForPDF>> {
		const analysisResult = await this.costAnalysis.generateCostAnalysis(
			deploymentId,
		);
		return ReportFormatter.formatForPDF(analysisResult, deploymentId);
	}

	/**
	 * Convert PDFReportData to WeeklyCostReport format
	 */
	private convertToWeeklyReport(
		analysisResult: any,
		pdfData: ReturnType<typeof ReportFormatter.formatForPDF>,
	): any {
		return {
			reportId: pdfData.metadata.reportId,
			generatedAt: pdfData.metadata.generatedAt,
			weekStartDate: pdfData.metadata.billingPeriod.start,
			weekEndDate: pdfData.metadata.billingPeriod.end,
			costSummary: {
				totalCurrentWeek: pdfData.costSummary.lastWeek.total,
				totalPreviousWeek: pdfData.costSummary.previousWeek.total,
				totalChangePercent: pdfData.costSummary.change.percent,
				totalChangeAmount: pdfData.costSummary.change.amount,
				monthlyProjection: pdfData.projections.monthly.projected,
				topServices: pdfData.topServices.map((s) => ({
					service: s.name,
					currentWeekCost: s.currentWeekCost,
					previousWeekCost: 0, // Not in PDF data
					changePercent: s.changePercent,
					changeAmount: 0,
					monthlyProjection: s.monthlyProjection,
				})),
				billingPeriodStart: pdfData.metadata.billingPeriod.start,
				billingPeriodEnd: pdfData.metadata.billingPeriod.end,
			},
			redFlags: pdfData.redFlags.items.map((flag) => ({
				id: flag.id,
				category: flag.category,
				severity: flag.severity,
				title: flag.title,
				description: flag.description,
				detectedAt: flag.detectedAt,
				resourceId: flag.resourceId,
				resourceType: flag.resourceType,
				estimatedMonthlyCost: flag.estimatedMonthlyCost,
				estimatedSavings: flag.estimatedSavings,
				autoFixable: flag.autoFixable,
				fixCommand: flag.fixCommand,
				metadata: {},
			})),
			optimizations: [], // Not in PDF data format, can be added later
			learningInsights: pdfData.learningInsights.map((i) => i.message),
			deploymentId: pdfData.metadata.deploymentId,
		};
	}

	/**
	 * Generate simple HTML email template
	 */
	private generateHTMLTemplate(
		pdfData: ReturnType<typeof ReportFormatter.formatForPDF>,
	): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>${pdfData.emailSubject}</title>
	<style>
		body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background: #4a90e2; color: white; padding: 20px; text-align: center; }
		.content { padding: 20px; background: #f9f9f9; }
		.summary-box { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4a90e2; }
		.red-flag { background: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; }
		.critical { background: #f8d7da; border-left-color: #dc3545; }
		.footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>Cloudable Cost Report</h1>
		</div>
		<div class="content">
			<h2>${pdfData.emailSubject}</h2>
			<p>${pdfData.emailSummary.replace(/\n/g, '<br>')}</p>
			
			<div class="summary-box">
				<h3>Cost Summary</h3>
				<p><strong>Last Week:</strong> ${pdfData.costSummary.lastWeek.formatted}</p>
				<p><strong>Change:</strong> ${pdfData.costSummary.change.formatted} (${pdfData.costSummary.change.direction})</p>
				<p><strong>Monthly Projection:</strong> ${pdfData.projections.monthly.formatted}</p>
			</div>

			${pdfData.redFlags.total > 0 ? `
				<div class="summary-box">
					<h3>Issues Detected (${pdfData.redFlags.total})</h3>
					<p>Critical: ${pdfData.redFlags.summary.critical} | 
					   Warning: ${pdfData.redFlags.summary.warning} | 
					   Info: ${pdfData.redFlags.summary.info}</p>
					<p><strong>Potential Savings:</strong> ${pdfData.redFlags.totalPotentialSavingsFormatted}</p>
				</div>
			` : ''}

			<p><strong>Full report attached as PDF.</strong></p>
			<p>Reply to this email to take action on recommendations.</p>
		</div>
		<div class="footer">
			<p>Generated by Cloudable - Intelligent AWS Cost Monitoring</p>
			<p>Report ID: ${pdfData.metadata.reportId}</p>
		</div>
	</div>
</body>
</html>
		`.trim();
	}
}

