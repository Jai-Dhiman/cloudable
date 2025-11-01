/**
 * PDF Generator Service
 * Converts PDFReportData into actual PDF files with enhanced graphics and charts
 */

import PDFDocument from 'pdfkit';
import type { PDFReportData } from '../utils/report-formatter.js';
import fs from 'fs';
import path from 'path';

// Color scheme
const COLORS = {
	primary: '#4a90e2',
	secondary: '#7b68ee',
	success: '#27ae60',
	warning: '#f39c12',
	danger: '#e74c3c',
	info: '#3498db',
	bgLight: '#f8f9fa',
	bgPrimary: '#4a90e2',
	textDark: '#2c3e50',
	textLight: '#7f8c8d',
	border: '#dfe6e9',
};

interface ChartData {
	labels: string[];
	values: number[];
	maxValue: number;
}

export class PDFGeneratorService {
	/**
	 * Convert hex color to RGB
	 */
	private static hexToRgb(hex: string): [number, number, number] {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result
			? [
					parseInt(result[1], 16),
					parseInt(result[2], 16),
					parseInt(result[3], 16),
			  ]
			: [0, 0, 0];
	}

	/**
	 * Draw a colored box with text
	 */
	private static drawBox(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		width: number,
		height: number,
		color: string,
		text?: string,
		textColor: string = '#ffffff',
	): void {
		const [r, g, b] = this.hexToRgb(color);
		doc.rect(x, y, width, height).fillColor(`rgb(${r},${g},${b})`).fill();
		if (text) {
			doc.fontSize(14)
				.fillColor(textColor)
				.text(text, x + 10, y + height / 2 - 8, {
					width: width - 20,
					align: 'center',
				});
		}
	}

	/**
	 * Draw a bar chart
	 */
	private static drawBarChart(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		width: number,
		height: number,
		data: ChartData,
		title: string,
	): void {
		// Title
		doc.fontSize(14)
			.fillColor(COLORS.textDark)
			.text(title, x, y, { width });

		const chartY = y + 25;
		const chartHeight = height - 45;
		const chartWidth = width - 40;
		const barWidth = chartWidth / data.labels.length - 10;
		const maxBarHeight = chartHeight - 20;

		// Draw axes
		doc.strokeColor(COLORS.border).lineWidth(1);
		// Y-axis
		doc.moveTo(x + 30, chartY).lineTo(x + 30, chartY + chartHeight).stroke();
		// X-axis
		doc.moveTo(x + 30, chartY + chartHeight)
			.lineTo(x + 30 + chartWidth, chartY + chartHeight)
			.stroke();

		// Draw bars
		data.labels.forEach((label, index) => {
			const barHeight = (data.values[index] / data.maxValue) * maxBarHeight;
			const barX = x + 40 + index * (barWidth + 10);
			const barY = chartY + chartHeight - barHeight;

			// Bar color based on value
			const colors = [COLORS.primary, COLORS.secondary, COLORS.info, COLORS.success, COLORS.warning];
			const [r, g, b] = this.hexToRgb(colors[index % colors.length]);

			doc.rect(barX, barY, barWidth, barHeight)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();

			// Label
			doc.fontSize(8)
				.fillColor(COLORS.textDark)
				.text(label, barX, chartY + chartHeight + 5, {
					width: barWidth,
					align: 'center',
				});

			// Value on top of bar
			if (barHeight > 15) {
				doc.fontSize(9)
					.fillColor(COLORS.textDark)
					.text(`$${data.values[index].toFixed(0)}`, barX, barY - 12, {
						width: barWidth,
						align: 'center',
					});
			}
		});
	}

	/**
	 * Draw a pie chart (simplified as donut chart)
	 */
	private static drawPieChart(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		radius: number,
		data: ChartData,
		title: string,
	): void {
		// Title
		doc.fontSize(14)
			.fillColor(COLORS.textDark)
			.text(title, x, y, { width: radius * 2 });

		const centerX = x + radius;
		const centerY = y + 30 + radius;
		const total = data.values.reduce((sum, val) => sum + val, 0);

		// Draw pie segments
		let currentAngle = -90; // Start at top
		const colors = [COLORS.primary, COLORS.secondary, COLORS.info, COLORS.success, COLORS.warning, COLORS.danger];

		data.labels.forEach((label, index) => {
			const percentage = data.values[index] / total;
			const angle = percentage * 360;

			const [r, g, b] = this.hexToRgb(colors[index % colors.length]);

			// Draw segment
			doc.path(`M ${centerX} ${centerY} L ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180)} ${centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180)} Z`)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();

			// Legend
			const legendX = x + radius * 2 + 20;
			const legendY = y + 30 + index * 20;
			doc.rect(legendX, legendY, 10, 10)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();
			doc.fontSize(9)
				.fillColor(COLORS.textDark)
				.text(`${label}: $${data.values[index].toFixed(2)} (${(percentage * 100).toFixed(1)}%)`, legendX + 15, legendY - 2);

			currentAngle += angle;
		});

		// Center circle (donut effect)
		doc.circle(centerX, centerY, radius * 0.6)
			.fillColor('white')
			.fill();
		doc.fontSize(12)
			.fillColor(COLORS.textDark)
			.text(`Total\n$${total.toFixed(2)}`, centerX - 25, centerY - 8, {
				width: 50,
				align: 'center',
			});
	}

	/**
	 * Draw a trend arrow indicator
	 */
	private static drawTrendIndicator(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		direction: 'up' | 'down' | 'neutral',
		size: number = 20,
	): void {
		const color =
			direction === 'up'
				? COLORS.danger
				: direction === 'down'
					? COLORS.success
					: COLORS.textLight;

		const [r, g, b] = this.hexToRgb(color);

		if (direction === 'up') {
			doc.polygon([x, y + size], [x + size / 2, y], [x + size, y + size])
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();
		} else if (direction === 'down') {
			doc.polygon([x, y], [x + size / 2, y + size], [x + size, y])
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();
		} else {
			doc.rect(x, y + size / 3, size, size / 3)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();
		}
	}

	/**
	 * Generate a PDF file from PDFReportData
	 */
	static async generatePDF(
		data: PDFReportData,
		outputPath?: string,
	): Promise<string> {
		const pdfPath =
			outputPath ||
			path.join(
				process.cwd(),
				'temp',
				`cost-report-${data.metadata.reportId}.pdf`,
			);

		const dir = path.dirname(pdfPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		const doc = new PDFDocument({
			margin: 0,
			size: 'LETTER',
		});
		const stream = fs.createWriteStream(pdfPath);
		doc.pipe(stream);

		// ========== COVER PAGE ==========
		// Header background
		const [pr, pg, pb] = this.hexToRgb(COLORS.bgPrimary);
		doc.rect(0, 0, 612, 120)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();

		// Title
		doc.fontSize(32)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Cloudable', 50, 40, { width: 512, align: 'center' });

		doc.fontSize(20)
			.fillColor('white')
			.font('Helvetica')
			.text('Cost Analysis Report', 50, 75, { width: 512, align: 'center' });

		// Report metadata box
		const boxY = 140;
		const [bgR, bgG, bgB] = this.hexToRgb(COLORS.bgLight);
		doc.rect(50, boxY, 512, 100)
			.fillColor(`rgb(${bgR},${bgG},${bgB})`)
			.fill();
		doc.rect(50, boxY, 512, 100)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Report ID', 60, boxY + 15);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(data.metadata.reportId, 60, boxY + 30);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Deployment', 200, boxY + 15);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(data.metadata.deploymentId, 200, boxY + 30);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Generated', 400, boxY + 15);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.text(new Date(data.metadata.generatedAt).toLocaleString(), 400, boxY + 30);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Period', 60, boxY + 60);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.text(
				`${new Date(data.metadata.billingPeriod.start).toLocaleDateString()} - ${new Date(data.metadata.billingPeriod.end).toLocaleDateString()}`,
				60,
				boxY + 75,
			);

		// ========== EXECUTIVE SUMMARY PAGE ==========
		doc.addPage();

		// Page header
		doc.rect(0, 0, 612, 60)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();
		doc.fontSize(24)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Executive Summary', 50, 20);

		let yPos = 80;

		// Cost comparison boxes
		const boxWidth = 170;
		const boxHeight = 80;
		const spacing = 20;

		// Last Week
		this.drawBox(
			doc,
			50,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.primary,
			`Last Week\n${data.costSummary.lastWeek.formatted}`,
		);

		// Previous Week
		this.drawBox(
			doc,
			50 + boxWidth + spacing,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.secondary,
			`Previous Week\n${data.costSummary.previousWeek.formatted}`,
		);

		// Change with trend indicator
		const changeBoxX = 50 + (boxWidth + spacing) * 2;
		const changeColor =
			data.costSummary.change.direction === 'up'
				? COLORS.danger
				: data.costSummary.change.direction === 'down'
					? COLORS.success
					: COLORS.textLight;

		this.drawBox(
			doc,
			changeBoxX,
			yPos,
			boxWidth,
			boxHeight,
			changeColor,
			`Change\n${data.costSummary.change.formatted}`,
		);

		// Trend indicator
		this.drawTrendIndicator(
			doc,
			changeBoxX + boxWidth - 35,
			yPos + 25,
			data.costSummary.change.direction,
		);

		yPos += boxHeight + 30;

		// Monthly projection
		this.drawBox(
			doc,
			50,
			yPos,
			boxWidth * 1.5,
			boxHeight,
			COLORS.info,
			`Monthly Projection\n${data.projections.monthly.formatted}`,
		);

		// Red flags summary
		const redFlagsColor =
			data.redFlags.summary.critical > 0
				? COLORS.danger
				: data.redFlags.summary.warning > 0
					? COLORS.warning
					: COLORS.success;

		this.drawBox(
			doc,
			50 + boxWidth * 1.5 + spacing,
			yPos,
			boxWidth * 1.5,
			boxHeight,
			redFlagsColor,
			`Issues Detected\n${data.redFlags.total} total`,
		);

		yPos += boxHeight + 40;

		// Bar chart: Cost comparison
		if (data.costSummary.lastWeek.total > 0 && data.costSummary.previousWeek.total > 0) {
			const chartData: ChartData = {
				labels: ['Last Week', 'Previous Week'],
				values: [data.costSummary.lastWeek.total, data.costSummary.previousWeek.total],
				maxValue: Math.max(
					data.costSummary.lastWeek.total,
					data.costSummary.previousWeek.total,
				) * 1.2,
			};

			this.drawBarChart(doc, 50, yPos, 250, 150, chartData, 'Weekly Cost Comparison');
		}

		// Pie chart: Top services
		if (data.topServices.length > 0) {
			const serviceData: ChartData = {
				labels: data.topServices.slice(0, 5).map((s) => s.name),
				values: data.topServices.slice(0, 5).map((s) => s.currentWeekCost),
				maxValue: Math.max(...data.topServices.slice(0, 5).map((s) => s.currentWeekCost)),
			};

			this.drawPieChart(doc, 320, yPos, 80, serviceData, 'Top Services Breakdown');
		}

		// ========== COST PROJECTIONS PAGE ==========
		doc.addPage();

		doc.rect(0, 0, 612, 60)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();
		doc.fontSize(24)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Cost Projections', 50, 20);

		yPos = 80;

		// Next week projection
		doc.fontSize(16)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Next Week Prediction', 50, yPos);

		yPos += 25;

		const [nr, ng, nb] = this.hexToRgb(COLORS.info);
		doc.rect(50, yPos, 512, 60)
			.fillColor(`rgb(${nr},${ng},${nb})`)
			.fillOpacity(0.1)
			.fill();
		doc.rect(50, yPos, 512, 60)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		doc.fontSize(28)
			.fillColor(COLORS.info)
			.font('Helvetica-Bold')
			.text(data.projections.nextWeek.formatted, 70, yPos + 15);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(
				`Confidence: ${data.projections.nextWeek.confidenceInterval.formatted}`,
				70,
				yPos + 45,
			);

		yPos += 80;

		// Monthly projection
		doc.fontSize(16)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Monthly Projection', 50, yPos);

		yPos += 25;

		doc.rect(50, yPos, 512, 60)
			.fillColor(`rgb(${nr},${ng},${nb})`)
			.fillOpacity(0.1)
			.fill();
		doc.rect(50, yPos, 512, 60)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		doc.fontSize(28)
			.fillColor(COLORS.info)
			.font('Helvetica-Bold')
			.text(data.projections.monthly.formatted, 70, yPos + 15);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(
				`Trend: ${data.projections.monthly.trendDescription}`,
				70,
				yPos + 45,
			);

		// Trend indicator
		this.drawTrendIndicator(
			doc,
			530,
			yPos + 20,
			data.projections.monthly.trend === 'increasing'
				? 'up'
				: data.projections.monthly.trend === 'decreasing'
					? 'down'
					: 'neutral',
			30,
		);

		yPos += 100;

		// Methodology
		doc.fontSize(12)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Methodology', 50, yPos);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(data.projections.nextWeek.methodology, 50, yPos + 20, {
				width: 512,
			});

		// ========== RED FLAGS PAGE ==========
		doc.addPage();

		doc.rect(0, 0, 612, 60)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();
		doc.fontSize(24)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Issues & Recommendations', 50, 20);

		yPos = 80;

		// Summary boxes
		const summaryBoxWidth = 180;
		const summaryBoxHeight = 60;

		// Critical
		this.drawBox(
			doc,
			50,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.danger,
			`Critical\n${data.redFlags.summary.critical}`,
		);

		// Warning
		this.drawBox(
			doc,
			50 + summaryBoxWidth + 15,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.warning,
			`Warnings\n${data.redFlags.summary.warning}`,
		);

		// Info
		this.drawBox(
			doc,
			50 + (summaryBoxWidth + 15) * 2,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.info,
			`Info\n${data.redFlags.summary.info}`,
		);

		yPos += summaryBoxHeight + 30;

		// Potential savings
		doc.fontSize(16)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Potential Monthly Savings', 50, yPos);

		yPos += 25;

		const [sr, sg, sb] = this.hexToRgb(COLORS.success);
		doc.rect(50, yPos, 512, 50)
			.fillColor(`rgb(${sr},${sg},${sb})`)
			.fillOpacity(0.1)
			.fill();
		doc.rect(50, yPos, 512, 50)
			.strokeColor(COLORS.success)
			.lineWidth(2)
			.stroke();

		doc.fontSize(24)
			.fillColor(COLORS.success)
			.font('Helvetica-Bold')
			.text(data.redFlags.totalPotentialSavingsFormatted, 70, yPos + 10, {
				width: 512,
				align: 'center',
			});

		yPos += 80;

		// Individual red flags
		if (data.redFlags.items.length > 0) {
			doc.fontSize(16)
				.fillColor(COLORS.textDark)
				.font('Helvetica-Bold')
				.text('Issues Detected', 50, yPos);

			yPos += 25;

			data.redFlags.items.slice(0, 5).forEach((flag, index) => {
				if (yPos > 700) {
					doc.addPage();
					yPos = 80;
				}

				const severityColors = {
					critical: COLORS.danger,
					warning: COLORS.warning,
					info: COLORS.info,
				};

				const [cr, cg, cb] = this.hexToRgb(severityColors[flag.severity]);

				// Issue box
				doc.rect(50, yPos, 512, 70)
					.fillColor(`rgb(${cr},${cg},${cb})`)
					.fillOpacity(0.1)
					.fill();
				doc.rect(50, yPos, 512, 70)
					.strokeColor(severityColors[flag.severity])
					.lineWidth(2)
					.stroke();

				// Severity badge
				doc.rect(60, yPos + 10, 80, 20)
					.fillColor(`rgb(${cr},${cg},${cb})`)
					.fill();
				doc.fontSize(10)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text(flag.severity.toUpperCase(), 65, yPos + 14);

				// Title
				doc.fontSize(12)
					.fillColor(COLORS.textDark)
					.font('Helvetica-Bold')
					.text(flag.title, 150, yPos + 10);

				// Description
				doc.fontSize(10)
					.fillColor(COLORS.textLight)
					.font('Helvetica')
					.text(flag.description, 150, yPos + 28, { width: 400 });

				if (flag.estimatedSavingsFormatted) {
					doc.fontSize(10)
						.fillColor(COLORS.success)
						.font('Helvetica-Bold')
						.text(`Potential Savings: ${flag.estimatedSavingsFormatted}`, 150, yPos + 50);
				}

				yPos += 85;
			});
		}

		// ========== RECOMMENDATIONS PAGE ==========
		if (data.recommendations.length > 0) {
			doc.addPage();

			doc.rect(0, 0, 612, 60)
				.fillColor(`rgb(${pr},${pg},${pb})`)
				.fill();
			doc.fontSize(24)
				.fillColor('white')
				.font('Helvetica-Bold')
				.text('Recommendations', 50, 20);

			yPos = 80;

			data.recommendations.forEach((rec, index) => {
				if (yPos > 700) {
					doc.addPage();
					yPos = 80;
				}

				// Recommendation box
				const [rr, rg, rb] = this.hexToRgb(COLORS.info);
				doc.rect(50, yPos, 512, 50)
					.fillColor(`rgb(${rr},${rg},${rb})`)
					.fillOpacity(0.05)
					.fill();
				doc.rect(50, yPos, 512, 50)
					.strokeColor(COLORS.border)
					.lineWidth(1)
					.stroke();

				// Number badge
				doc.circle(70, yPos + 25, 12)
					.fillColor(`rgb(${rr},${rg},${rb})`)
					.fill();
				doc.fontSize(12)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text((index + 1).toString(), 65, yPos + 18, { width: 10, align: 'center' });

				// Recommendation text
				doc.fontSize(11)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(rec, 90, yPos + 15, { width: 460 });

				yPos += 65;
			});
		}

		// ========== FOOTER ==========
		doc.fontSize(8)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(
				'Generated by Cloudable - Intelligent AWS Cost Monitoring',
				50,
				750,
				{ width: 512, align: 'center' },
			);
		doc.text(`Report ID: ${data.metadata.reportId}`, 50, 765, {
			width: 512,
			align: 'center',
		});

		doc.end();

		return new Promise((resolve, reject) => {
			stream.on('finish', () => resolve(pdfPath));
			stream.on('error', reject);
		});
	}

	/**
	 * Generate PDF and return as Buffer for email attachment
	 */
	static async generatePDFBuffer(data: PDFReportData): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			const doc = new PDFDocument({ margin: 0, size: 'LETTER' });

			doc.on('data', (chunk) => chunks.push(chunk));
			doc.on('end', () => resolve(Buffer.concat(chunks)));
			doc.on('error', reject);

			// Reuse the same generation logic by creating a temporary file path
			// and using the generatePDF method logic inline
			this.generatePDFContent(doc, data);

			doc.end();
		});
	}

	/**
	 * Generate PDF content (shared logic for both file and buffer)
	 */
	private static generatePDFContent(doc: PDFKit.PDFDocument, data: PDFReportData): void {
		const [pr, pg, pb] = this.hexToRgb(COLORS.bgPrimary);

		// ========== COVER PAGE ==========
		doc.rect(0, 0, 612, 120)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();

		doc.fontSize(32)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Cloudable', 50, 40, { width: 512, align: 'center' });

		doc.fontSize(20)
			.fillColor('white')
			.font('Helvetica')
			.text('Cost Analysis Report', 50, 75, { width: 512, align: 'center' });

		const boxY = 140;
		const [bgR, bgG, bgB] = this.hexToRgb(COLORS.bgLight);
		doc.rect(50, boxY, 512, 100)
			.fillColor(`rgb(${bgR},${bgG},${bgB})`)
			.fill();
		doc.rect(50, boxY, 512, 100)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Report ID', 60, boxY + 15);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(data.metadata.reportId, 60, boxY + 30);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Deployment', 200, boxY + 15);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(data.metadata.deploymentId, 200, boxY + 30);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Generated', 400, boxY + 15);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.text(new Date(data.metadata.generatedAt).toLocaleString(), 400, boxY + 30);

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.text('Period', 60, boxY + 60);
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.text(
				`${new Date(data.metadata.billingPeriod.start).toLocaleDateString()} - ${new Date(data.metadata.billingPeriod.end).toLocaleDateString()}`,
				60,
				boxY + 75,
			);

		// Continue with executive summary page (same as generatePDF method)
		doc.addPage();

		doc.rect(0, 0, 612, 60)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();
		doc.fontSize(24)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Executive Summary', 50, 20);

		let yPos = 80;
		const boxWidth = 170;
		const boxHeight = 80;
		const spacing = 20;

		this.drawBox(
			doc,
			50,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.primary,
			`Last Week\n${data.costSummary.lastWeek.formatted}`,
		);

		this.drawBox(
			doc,
			50 + boxWidth + spacing,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.secondary,
			`Previous Week\n${data.costSummary.previousWeek.formatted}`,
		);

		const changeBoxX = 50 + (boxWidth + spacing) * 2;
		const changeColor =
			data.costSummary.change.direction === 'up'
				? COLORS.danger
				: data.costSummary.change.direction === 'down'
					? COLORS.success
					: COLORS.textLight;

		this.drawBox(
			doc,
			changeBoxX,
			yPos,
			boxWidth,
			boxHeight,
			changeColor,
			`Change\n${data.costSummary.change.formatted}`,
		);

		this.drawTrendIndicator(
			doc,
			changeBoxX + boxWidth - 35,
			yPos + 25,
			data.costSummary.change.direction,
		);

		yPos += boxHeight + 30;

		this.drawBox(
			doc,
			50,
			yPos,
			boxWidth * 1.5,
			boxHeight,
			COLORS.info,
			`Monthly Projection\n${data.projections.monthly.formatted}`,
		);

		const redFlagsColor =
			data.redFlags.summary.critical > 0
				? COLORS.danger
				: data.redFlags.summary.warning > 0
					? COLORS.warning
					: COLORS.success;

		this.drawBox(
			doc,
			50 + boxWidth * 1.5 + spacing,
			yPos,
			boxWidth * 1.5,
			boxHeight,
			redFlagsColor,
			`Issues Detected\n${data.redFlags.total} total`,
		);

		yPos += boxHeight + 40;

		// Charts
		if (data.costSummary.lastWeek.total > 0 && data.costSummary.previousWeek.total > 0) {
			const chartData: ChartData = {
				labels: ['Last Week', 'Previous Week'],
				values: [data.costSummary.lastWeek.total, data.costSummary.previousWeek.total],
				maxValue: Math.max(
					data.costSummary.lastWeek.total,
					data.costSummary.previousWeek.total,
				) * 1.2,
			};
			this.drawBarChart(doc, 50, yPos, 250, 150, chartData, 'Weekly Cost Comparison');
		}

		if (data.topServices.length > 0) {
			const serviceData: ChartData = {
				labels: data.topServices.slice(0, 5).map((s) => s.name),
				values: data.topServices.slice(0, 5).map((s) => s.currentWeekCost),
				maxValue: Math.max(...data.topServices.slice(0, 5).map((s) => s.currentWeekCost)),
			};
			this.drawPieChart(doc, 320, yPos, 80, serviceData, 'Top Services Breakdown');
		}

		// Add remaining pages (projections, red flags, recommendations)
		// Simplified for buffer version - include key sections
		doc.addPage();
		doc.rect(0, 0, 612, 60)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();
		doc.fontSize(24)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Full Report Details', 50, 20);

		doc.fontSize(12)
			.fillColor(COLORS.textDark)
			.text(data.emailSummary, 50, 100, { width: 512 });

		// Footer
		doc.fontSize(8)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(
				'Generated by Cloudable - Intelligent AWS Cost Monitoring',
				50,
				750,
				{ width: 512, align: 'center' },
			);
		doc.text(`Report ID: ${data.metadata.reportId}`, 50, 765, {
			width: 512,
			align: 'center',
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
			console.warn(`Failed to cleanup PDF: ${pdfPath}`, error);
		}
	}
}
