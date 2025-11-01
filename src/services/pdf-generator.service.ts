/**
 * PDF Generator Service
 * Converts PDFReportData into actual PDF files
 */

import PDFDocument from 'pdfkit';
import type { PDFReportData } from '../utils/report-formatter.js';
import fs from 'fs';
import path from 'path';

export class PDFGeneratorService {
	/**
	 * Generate a PDF file from PDFReportData
	 * @param data The formatted report data
	 * @param outputPath Optional file path. If not provided, creates a temp file
	 * @returns The path to the generated PDF file
	 */
	static async generatePDF(
		data: PDFReportData,
		outputPath?: string,
	): Promise<string> {
		// Create output path if not provided
		const pdfPath =
			outputPath ||
			path.join(
				process.cwd(),
				'temp',
				`cost-report-${data.metadata.reportId}.pdf`,
			);

		// Ensure directory exists
		const dir = path.dirname(pdfPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		// Create PDF document
		const doc = new PDFDocument({ margin: 50 });

		// Pipe to file
		const stream = fs.createWriteStream(pdfPath);
		doc.pipe(stream);

		// Header
		doc.fontSize(24).text('Cloudable Cost Report', { align: 'center' });
		doc.moveDown();
		doc.fontSize(12).text(data.emailSubject, { align: 'center' });
		doc.moveDown();

		// Metadata
		doc.fontSize(10);
		doc.text(`Report ID: ${data.metadata.reportId}`);
		doc.text(`Generated: ${new Date(data.metadata.generatedAt).toLocaleString()}`);
		doc.text(`Deployment: ${data.metadata.deploymentId}`);
		doc.text(
			`Period: ${new Date(data.metadata.billingPeriod.start).toLocaleDateString()} - ${new Date(data.metadata.billingPeriod.end).toLocaleDateString()}`,
		);
		doc.moveDown();

		// Cost Summary Section
		doc.fontSize(16).text('Cost Summary', { underline: true });
		doc.moveDown();
		doc.fontSize(12);

		doc.text(`Last Week: ${data.costSummary.lastWeek.formatted}`);
		doc.text(`Previous Week: ${data.costSummary.previousWeek.formatted}`);
		doc.text(`Change: ${data.costSummary.change.formatted} (${data.costSummary.change.direction})`);
		doc.moveDown();

		// Projections Section
		doc.fontSize(16).text('Cost Projections', { underline: true });
		doc.moveDown();
		doc.fontSize(12);

		doc.text(`Next Week: ${data.projections.nextWeek.formatted}`);
		doc.text(
			`Confidence Interval: ${data.projections.nextWeek.confidenceInterval.formatted}`,
		);
		doc.text(`Methodology: ${data.projections.nextWeek.methodology}`);
		doc.moveDown();

		doc.text(`Monthly Projection: ${data.projections.monthly.formatted}`);
		doc.text(
			`Confidence Interval: ${data.projections.monthly.confidenceInterval.formatted}`,
		);
		doc.text(`Trend: ${data.projections.monthly.trendDescription}`);
		doc.moveDown();

		// Top Services Section
		if (data.topServices.length > 0) {
			doc.fontSize(16).text('Top Services', { underline: true });
			doc.moveDown();
			doc.fontSize(12);

			data.topServices.forEach((service, index) => {
				doc.text(
					`${index + 1}. ${service.name}: ${service.currentWeekFormatted} (${service.changeFormatted})`,
				);
				doc.text(`   Monthly Projection: ${service.monthlyFormatted}`);
				doc.moveDown(0.5);
			});
		}

		// Red Flags Section
		doc.addPage();
		doc.fontSize(16).text('Red Flags & Issues', { underline: true });
		doc.moveDown();
		doc.fontSize(12);

		doc.text(`Total Issues: ${data.redFlags.total}`);
		doc.text(
			`Critical: ${data.redFlags.summary.critical} | Warning: ${data.redFlags.summary.warning} | Info: ${data.redFlags.summary.info}`,
		);
		doc.text(
			`Potential Savings: ${data.redFlags.totalPotentialSavingsFormatted}`,
		);
		doc.moveDown();

		if (data.redFlags.items.length > 0) {
			data.redFlags.items.forEach((flag, index) => {
				const severityColor =
					flag.severity === 'critical'
						? 'red'
						: flag.severity === 'warning'
							? 'orange'
							: 'blue';

				doc.text(`${index + 1}. [${flag.severity.toUpperCase()}] ${flag.title}`, {
					continued: false,
				});
				doc.text(`   Category: ${flag.category}`, { indent: 20 });
				doc.text(`   ${flag.description}`, { indent: 20 });

				if (flag.estimatedSavings) {
					doc.text(
						`   Potential Savings: ${flag.estimatedSavingsFormatted}`,
						{ indent: 20 },
					);
				}

				if (flag.autoFixable && flag.fixCommand) {
					doc.text(`   Auto-fixable: ${flag.fixCommand}`, { indent: 20 });
				}

				doc.moveDown();
			});
		}

		// Learning Insights Section
		if (data.learningInsights.length > 0) {
			doc.fontSize(16).text('Learning Insights', { underline: true });
			doc.moveDown();
			doc.fontSize(12);

			data.learningInsights.forEach((insight) => {
				doc.text(`• [${insight.type}] ${insight.message}`);
				doc.text(`  Confidence: ${insight.confidenceFormatted} | Source: ${insight.source}`, {
					indent: 20,
				});
				doc.moveDown(0.5);
			});
		}

		// Recommendations Section
		if (data.recommendations.length > 0) {
			doc.fontSize(16).text('Recommendations', { underline: true });
			doc.moveDown();
			doc.fontSize(12);

			data.recommendations.forEach((rec, index) => {
				doc.text(`${index + 1}. ${rec}`);
				doc.moveDown(0.5);
			});
		}

		// Summary
		doc.addPage();
		doc.fontSize(16).text('Summary', { underline: true });
		doc.moveDown();
		doc.fontSize(12);
		doc.text(data.emailSummary);

		// Footer on last page
		doc.fontSize(8);
		doc.text(
			'Generated by Cloudable - Intelligent AWS Cost Monitoring',
			{ align: 'center' },
		);
		doc.text(`Report ID: ${data.metadata.reportId}`, { align: 'center' });

		// Finalize PDF
		doc.end();

		// Wait for PDF to be written
		return new Promise((resolve, reject) => {
			stream.on('finish', () => {
				resolve(pdfPath);
			});
			stream.on('error', reject);
		});
	}

	/**
	 * Generate PDF and return as Buffer for email attachment
	 */
	static async generatePDFBuffer(data: PDFReportData): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			const doc = new PDFDocument({ margin: 50 });

			doc.on('data', (chunk) => chunks.push(chunk));
			doc.on('end', () => resolve(Buffer.concat(chunks)));
			doc.on('error', reject);

			// Header
			doc.fontSize(24).text('Cloudable Cost Report', { align: 'center' });
			doc.moveDown();
			doc.fontSize(12).text(data.emailSubject, { align: 'center' });
			doc.moveDown();

			// Metadata
			doc.fontSize(10);
			doc.text(`Report ID: ${data.metadata.reportId}`);
			doc.text(`Generated: ${new Date(data.metadata.generatedAt).toLocaleString()}`);
			doc.text(`Deployment: ${data.metadata.deploymentId}`);
			doc.text(
				`Period: ${new Date(data.metadata.billingPeriod.start).toLocaleDateString()} - ${new Date(data.metadata.billingPeriod.end).toLocaleDateString()}`,
			);
			doc.moveDown();

			// Cost Summary Section
			doc.fontSize(16).text('Cost Summary', { underline: true });
			doc.moveDown();
			doc.fontSize(12);

			doc.text(`Last Week: ${data.costSummary.lastWeek.formatted}`);
			doc.text(`Previous Week: ${data.costSummary.previousWeek.formatted}`);
			doc.text(`Change: ${data.costSummary.change.formatted} (${data.costSummary.change.direction})`);
			doc.moveDown();

			// Projections Section
			doc.fontSize(16).text('Cost Projections', { underline: true });
			doc.moveDown();
			doc.fontSize(12);

			doc.text(`Next Week: ${data.projections.nextWeek.formatted}`);
			doc.text(
				`Confidence Interval: ${data.projections.nextWeek.confidenceInterval.formatted}`,
			);
			doc.text(`Methodology: ${data.projections.nextWeek.methodology}`);
			doc.moveDown();

			doc.text(`Monthly Projection: ${data.projections.monthly.formatted}`);
			doc.text(
				`Confidence Interval: ${data.projections.monthly.confidenceInterval.formatted}`,
			);
			doc.text(`Trend: ${data.projections.monthly.trendDescription}`);
			doc.moveDown();

			// Top Services Section
			if (data.topServices.length > 0) {
				doc.fontSize(16).text('Top Services', { underline: true });
				doc.moveDown();
				doc.fontSize(12);

				data.topServices.forEach((service, index) => {
					doc.text(
						`${index + 1}. ${service.name}: ${service.currentWeekFormatted} (${service.changeFormatted})`,
					);
					doc.text(`   Monthly Projection: ${service.monthlyFormatted}`);
					doc.moveDown(0.5);
				});
			}

			// Red Flags Section
			doc.addPage();
			doc.fontSize(16).text('Red Flags & Issues', { underline: true });
			doc.moveDown();
			doc.fontSize(12);

			doc.text(`Total Issues: ${data.redFlags.total}`);
			doc.text(
				`Critical: ${data.redFlags.summary.critical} | Warning: ${data.redFlags.summary.warning} | Info: ${data.redFlags.summary.info}`,
			);
			doc.text(
				`Potential Savings: ${data.redFlags.totalPotentialSavingsFormatted}`,
			);
			doc.moveDown();

			if (data.redFlags.items.length > 0) {
				data.redFlags.items.forEach((flag, index) => {
					doc.text(`${index + 1}. [${flag.severity.toUpperCase()}] ${flag.title}`, {
						continued: false,
					});
					doc.text(`   Category: ${flag.category}`, { indent: 20 });
					doc.text(`   ${flag.description}`, { indent: 20 });

					if (flag.estimatedSavings) {
						doc.text(
							`   Potential Savings: ${flag.estimatedSavingsFormatted}`,
							{ indent: 20 },
						);
					}

					if (flag.autoFixable && flag.fixCommand) {
						doc.text(`   Auto-fixable: ${flag.fixCommand}`, { indent: 20 });
					}

					doc.moveDown();
				});
			}

			// Learning Insights Section
			if (data.learningInsights.length > 0) {
				doc.fontSize(16).text('Learning Insights', { underline: true });
				doc.moveDown();
				doc.fontSize(12);

				data.learningInsights.forEach((insight) => {
					doc.text(`• [${insight.type}] ${insight.message}`);
					doc.text(`  Confidence: ${insight.confidenceFormatted} | Source: ${insight.source}`, {
						indent: 20,
					});
					doc.moveDown(0.5);
				});
			}

			// Recommendations Section
			if (data.recommendations.length > 0) {
				doc.fontSize(16).text('Recommendations', { underline: true });
				doc.moveDown();
				doc.fontSize(12);

				data.recommendations.forEach((rec, index) => {
					doc.text(`${index + 1}. ${rec}`);
					doc.moveDown(0.5);
				});
			}

			// Summary
			doc.addPage();
			doc.fontSize(16).text('Summary', { underline: true });
			doc.moveDown();
			doc.fontSize(12);
			doc.text(data.emailSummary);

			// Footer
			doc.fontSize(8);
			doc.text(
				'Generated by Cloudable - Intelligent AWS Cost Monitoring',
				{ align: 'center' },
			);
			doc.text(`Report ID: ${data.metadata.reportId}`, { align: 'center' });

			doc.end();
		});
	}

	/**
	 * Clean up temporary PDF files
	 */
	static cleanupTempPDF(pdfPath: string): void {
		try {
			if (fs.existsSync(pdfPath) && pdfPath.includes('temp')) {
				fs.unlinkSync(pdfPath);
			}
		} catch (error) {
			// Ignore cleanup errors
			console.warn(`Failed to cleanup PDF: ${pdfPath}`, error);
		}
	}
}

