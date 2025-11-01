/**
 * PDF Generator Service
 * Enhanced PDF generation with proper spacing, indentation, colors, and comprehensive details
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

// Layout constants
const LAYOUT = {
	margin: 50,
	contentWidth: 512,
	sectionSpacing: 30,
	elementSpacing: 15,
	lineHeight: 1.4,
	headingLineHeight: 1.6,
	boxPadding: 15,
	tableRowHeight: 25,
	cardSpacing: 20,
	pageBottom: 750,
	headerHeight: 60,
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
	 * Draw section header with consistent styling
	 */
	private static drawSectionHeader(
		doc: PDFKit.PDFDocument,
		title: string,
		y: number,
	): number {
		const [pr, pg, pb] = this.hexToRgb(COLORS.bgPrimary);
		doc.rect(0, y, 612, LAYOUT.headerHeight)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();

		doc.fontSize(24)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text(title, LAYOUT.margin, y + 20);

		return y + LAYOUT.headerHeight + LAYOUT.elementSpacing;
	}

	/**
	 * Draw labeled field with proper spacing and colors
	 */
	private static drawLabeledField(
		doc: PDFKit.PDFDocument,
		label: string,
		value: string,
		x: number,
		y: number,
		options?: {
			labelWidth?: number;
			valueColor?: string;
			labelSize?: number;
			valueSize?: number;
		},
	): number {
		const labelWidth = options?.labelWidth || 150;
		const labelSize = options?.labelSize || 10;
		const valueSize = options?.valueSize || 11;
		const valueColor = options?.valueColor || COLORS.textDark;

		// Label
		doc.fontSize(labelSize)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(label, x, y);

		// Value
		doc.fontSize(valueSize)
			.fillColor(valueColor)
			.font('Helvetica-Bold')
			.text(value, x + labelWidth, y);

		return y + valueSize + LAYOUT.elementSpacing;
	}

	/**
	 * Draw a colored box with text and proper padding
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
		doc.rect(x, y, width, height)
			.fillColor(`rgb(${r},${g},${b})`)
			.fill();
		if (text) {
			doc.fontSize(14)
				.fillColor(textColor)
				.font('Helvetica-Bold')
				.text(text, x + LAYOUT.boxPadding, y + height / 2 - 8, {
					width: width - LAYOUT.boxPadding * 2,
					align: 'center',
				});
		}
	}

	/**
	 * Draw metric card with label and value
	 */
	private static drawMetricCard(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		width: number,
		height: number,
		label: string,
		value: string,
		color: string,
		subtext?: string,
	): void {
		const [r, g, b] = this.hexToRgb(color);
		// Background
		doc.rect(x, y, width, height)
			.fillColor(`rgb(${r},${g},${b})`)
			.fillOpacity(0.1)
			.fill();
		doc.rect(x, y, width, height)
			.strokeColor(color)
			.lineWidth(2)
			.stroke();

		// Label
		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(label, x + LAYOUT.boxPadding, y + LAYOUT.boxPadding);

		// Value
		doc.fontSize(20)
			.fillColor(color)
			.font('Helvetica-Bold')
			.text(value, x + LAYOUT.boxPadding, y + LAYOUT.boxPadding + 15);

		// Subtext
		if (subtext) {
			doc.fontSize(9)
				.fillColor(COLORS.textLight)
				.font('Helvetica')
				.text(subtext, x + LAYOUT.boxPadding, y + height - 20);
		}
	}

	/**
	 * Draw data table with alternating row colors
	 */
	private static drawDataTable(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		headers: string[],
		rows: string[][],
		columnWidths: number[],
	): number {
		const headerHeight = 30;
		const rowHeight = LAYOUT.tableRowHeight;

		// Header background
		const [pr, pg, pb] = this.hexToRgb(COLORS.primary);
		doc.rect(x, y, columnWidths.reduce((a, b) => a + b, 0), headerHeight)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fillOpacity(0.2)
			.fill();
		doc.rect(x, y, columnWidths.reduce((a, b) => a + b, 0), headerHeight)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		// Headers
		let currentX = x + LAYOUT.boxPadding;
		doc.fontSize(11)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold');
		headers.forEach((header, index) => {
			doc.text(header, currentX, y + 8, {
				width: columnWidths[index] - LAYOUT.boxPadding * 2,
			});
			currentX += columnWidths[index];
		});

		let currentY = y + headerHeight;

		// Rows
		rows.forEach((row, rowIndex) => {
			// Alternating row colors
			if (rowIndex % 2 === 0) {
				const [bgR, bgG, bgB] = this.hexToRgb(COLORS.bgLight);
				doc.rect(
					x,
					currentY,
					columnWidths.reduce((a, b) => a + b, 0),
					rowHeight,
				)
					.fillColor(`rgb(${bgR},${bgG},${bgB})`)
					.fill();
			}

			// Row border
			doc.rect(
				x,
				currentY,
				columnWidths.reduce((a, b) => a + b, 0),
				rowHeight,
			)
				.strokeColor(COLORS.border)
				.lineWidth(0.5)
				.stroke();

			// Row content
			currentX = x + LAYOUT.boxPadding;
			doc.fontSize(10)
				.fillColor(COLORS.textDark)
				.font('Helvetica');
			row.forEach((cell, cellIndex) => {
				doc.text(cell, currentX, currentY + 7, {
					width: columnWidths[cellIndex] - LAYOUT.boxPadding * 2,
				});
				currentX += columnWidths[cellIndex];
			});

			currentY += rowHeight;
		});

		return currentY;
	}

	/**
	 * Draw a bar chart with proper spacing
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
			.font('Helvetica-Bold')
			.text(title, x, y, { width });
		doc.moveDown(0.5);

		const chartY = y + 30;
		const chartHeight = height - 50;
		const chartWidth = width - 40;
		const barWidth = chartWidth / data.labels.length - 10;
		const maxBarHeight = chartHeight - 20;

		// Draw axes
		doc.strokeColor(COLORS.border).lineWidth(1);
		doc.moveTo(x + 30, chartY).lineTo(x + 30, chartY + chartHeight).stroke();
		doc.moveTo(x + 30, chartY + chartHeight)
			.lineTo(x + 30 + chartWidth, chartY + chartHeight)
			.stroke();

		// Draw bars
		data.labels.forEach((label, index) => {
			const barHeight = (data.values[index] / data.maxValue) * maxBarHeight;
			const barX = x + 40 + index * (barWidth + 10);
			const barY = chartY + chartHeight - barHeight;

			const colors = [
				COLORS.primary,
				COLORS.secondary,
				COLORS.info,
				COLORS.success,
				COLORS.warning,
			];
			const [r, g, b] = this.hexToRgb(colors[index % colors.length]);

			doc.rect(barX, barY, barWidth, barHeight)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();

			doc.fontSize(8)
				.fillColor(COLORS.textDark)
				.text(label, barX, chartY + chartHeight + 5, {
					width: barWidth,
					align: 'center',
				});

			if (barHeight > 15) {
				doc.fontSize(9)
					.fillColor(COLORS.textDark)
					.font('Helvetica-Bold')
					.text(`$${data.values[index].toFixed(0)}`, barX, barY - 12, {
						width: barWidth,
						align: 'center',
					});
			}
		});
	}

	/**
	 * Draw a pie chart (donut chart)
	 */
	private static drawPieChart(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		radius: number,
		data: ChartData,
		title: string,
	): void {
		doc.fontSize(14)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(title, x, y, { width: radius * 2 });

		const centerX = x + radius;
		const centerY = y + 30 + radius;
		const total = data.values.reduce((sum, val) => sum + val, 0);

		let currentAngle = -90;
		const colors = [
			COLORS.primary,
			COLORS.secondary,
			COLORS.info,
			COLORS.success,
			COLORS.warning,
			COLORS.danger,
		];

		data.labels.forEach((label, index) => {
			const percentage = data.values[index] / total;
			const angle = percentage * 360;
			const [r, g, b] = this.hexToRgb(colors[index % colors.length]);

			doc.path(
				`M ${centerX} ${centerY} L ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180)} ${centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180)} Z`,
			)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();

			const legendX = x + radius * 2 + 20;
			const legendY = y + 30 + index * 20;
			doc.rect(legendX, legendY, 10, 10)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();
			doc.fontSize(9)
				.fillColor(COLORS.textDark)
				.text(
					`${label}: ${data.values[index].toFixed(2)} (${(percentage * 100).toFixed(1)}%)`,
					legendX + 15,
					legendY - 2,
				);

			currentAngle += angle;
		});

		doc.circle(centerX, centerY, radius * 0.6).fillColor('white').fill();
		doc.fontSize(12)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(`Total\n$${total.toFixed(2)}`, centerX - 25, centerY - 8, {
				width: 50,
				align: 'center',
			});
	}

	/**
	 * Draw trend indicator arrow
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
	 * Add page break with footer if needed
	 */
	private static addPageBreak(
		doc: PDFKit.PDFDocument,
		currentY: number,
		minSpace: number = 100,
	): number {
		if (currentY > LAYOUT.pageBottom - minSpace) {
			this.drawFooter(doc, LAYOUT.pageBottom);
			doc.addPage();
			return LAYOUT.margin;
		}
		return currentY;
	}

	/**
	 * Draw footer on current page
	 */
	private static drawFooter(
		doc: PDFKit.PDFDocument,
		y: number,
		reportId?: string,
	): void {
		doc.fontSize(8)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(
				'Generated by Cloudable - Intelligent AWS Cost Monitoring',
				LAYOUT.margin,
				y,
				{ width: LAYOUT.contentWidth, align: 'center' },
			);
		if (reportId) {
			doc.text(`Report ID: ${reportId}`, LAYOUT.margin, y + 12, {
				width: LAYOUT.contentWidth,
				align: 'center',
			});
		}
	}

	/**
	 * Generate complete PDF content (unified method)
	 */
	private static generateFullPDFContent(
		doc: PDFKit.PDFDocument,
		data: PDFReportData,
	): void {
		const [pr, pg, pb] = this.hexToRgb(COLORS.bgPrimary);
		let yPos = LAYOUT.margin;

		// ========== COVER PAGE ==========
		doc.rect(0, 0, 612, 120)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();

		doc.fontSize(32)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Cloudable', LAYOUT.margin, 40, {
				width: LAYOUT.contentWidth,
				align: 'center',
			});

		doc.fontSize(20)
			.fillColor('white')
			.font('Helvetica')
			.text('Cost Analysis Report', LAYOUT.margin, 75, {
				width: LAYOUT.contentWidth,
				align: 'center',
			});

		const boxY = 140;
		const [bgR, bgG, bgB] = this.hexToRgb(COLORS.bgLight);
		doc.rect(LAYOUT.margin, boxY, LAYOUT.contentWidth, 120)
			.fillColor(`rgb(${bgR},${bgG},${bgB})`)
			.fill();
		doc.rect(LAYOUT.margin, boxY, LAYOUT.contentWidth, 120)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		yPos = boxY + LAYOUT.boxPadding;
		yPos = this.drawLabeledField(
			doc,
			'Report ID:',
			data.metadata.reportId,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
		);
		yPos = this.drawLabeledField(
			doc,
			'Deployment:',
			data.metadata.deploymentId,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
		);
		yPos = this.drawLabeledField(
			doc,
			'Generated:',
			new Date(data.metadata.generatedAt).toLocaleString(),
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
		);
		yPos = this.drawLabeledField(
			doc,
			'Billing Period:',
			`${new Date(data.metadata.billingPeriod.start).toLocaleDateString()} - ${new Date(data.metadata.billingPeriod.end).toLocaleDateString()}`,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
		);

		// ========== EXECUTIVE SUMMARY PAGE ==========
		doc.addPage();
		yPos = this.drawSectionHeader(doc, 'Executive Summary', 0);

		// Cost comparison boxes with proper spacing
		const boxWidth = 170;
		const boxHeight = 80;
		const spacing = 20;

		this.drawBox(
			doc,
			LAYOUT.margin,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.primary,
			`Last Week\n${data.costSummary.lastWeek.formatted}`,
		);

		this.drawBox(
			doc,
			LAYOUT.margin + boxWidth + spacing,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.secondary,
			`Previous Week\n${data.costSummary.previousWeek.formatted}`,
		);

		const changeBoxX = LAYOUT.margin + (boxWidth + spacing) * 2;
		const changeColor =
			data.costSummary.change.direction === 'up'
				? COLORS.danger
				: data.costSummary.change.direction === 'down'
					? COLORS.success
					: COLORS.info;

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

		yPos += boxHeight + LAYOUT.sectionSpacing;

		// Monthly projection and issues
		this.drawBox(
			doc,
			LAYOUT.margin,
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
			LAYOUT.margin + boxWidth * 1.5 + spacing,
			yPos,
			boxWidth * 1.5,
			boxHeight,
			redFlagsColor,
			`Issues Detected\n${data.redFlags.total} total`,
		);

		yPos += boxHeight + LAYOUT.sectionSpacing;

		// Charts with proper spacing
		if (
			data.costSummary.lastWeek.total > 0 &&
			data.costSummary.previousWeek.total > 0
		) {
			const chartData: ChartData = {
				labels: ['Last Week', 'Previous Week'],
				values: [
					data.costSummary.lastWeek.total,
					data.costSummary.previousWeek.total,
				],
				maxValue:
					Math.max(
						data.costSummary.lastWeek.total,
						data.costSummary.previousWeek.total,
					) * 1.2,
			};
			this.drawBarChart(doc, LAYOUT.margin, yPos, 250, 150, chartData, 'Weekly Cost Comparison');
		}

		if (data.topServices.length > 0) {
			const serviceData: ChartData = {
				labels: data.topServices.slice(0, 5).map((s) => s.name),
				values: data.topServices.slice(0, 5).map((s) => s.currentWeekCost),
				maxValue: Math.max(
					...data.topServices.slice(0, 5).map((s) => s.currentWeekCost),
				),
			};
			this.drawPieChart(doc, 320, yPos, 80, serviceData, 'Top Services Breakdown');
		}

		// ========== COST PROJECTIONS PAGE ==========
		doc.addPage();
		yPos = this.drawSectionHeader(doc, 'Cost Projections', 0);

		// Next week projection
		doc.fontSize(16)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Next Week Prediction', LAYOUT.margin, yPos);
		yPos += 25;

		const [nr, ng, nb] = this.hexToRgb(COLORS.info);
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
			.fillColor(`rgb(${nr},${ng},${nb})`)
			.fillOpacity(0.1)
			.fill();
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		doc.fontSize(28)
			.fillColor(COLORS.info)
			.font('Helvetica-Bold')
			.text(data.projections.nextWeek.formatted, LAYOUT.margin + LAYOUT.boxPadding, yPos + 15);

		yPos = this.drawLabeledField(
			doc,
			'Confidence Interval:',
			data.projections.nextWeek.confidenceInterval.formatted,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos + 45,
			{ labelWidth: 200 },
		);

		yPos += LAYOUT.sectionSpacing;

		// Monthly projection
		doc.fontSize(16)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Monthly Projection', LAYOUT.margin, yPos);
		yPos += 25;

		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
			.fillColor(`rgb(${nr},${ng},${nb})`)
			.fillOpacity(0.1)
			.fill();
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		doc.fontSize(28)
			.fillColor(COLORS.info)
			.font('Helvetica-Bold')
			.text(data.projections.monthly.formatted, LAYOUT.margin + LAYOUT.boxPadding, yPos + 15);

		this.drawTrendIndicator(
			doc,
			LAYOUT.margin + LAYOUT.contentWidth - 50,
			yPos + 20,
			data.projections.monthly.trend === 'increasing'
				? 'up'
				: data.projections.monthly.trend === 'decreasing'
					? 'down'
					: 'neutral',
			30,
		);

		yPos = this.drawLabeledField(
			doc,
			'Trend:',
			data.projections.monthly.trendDescription,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos + 45,
			{ labelWidth: 200 },
		);

		yPos += LAYOUT.sectionSpacing;

		// Methodology
		doc.fontSize(14)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Methodology', LAYOUT.margin, yPos);
		yPos += LAYOUT.elementSpacing;

		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(data.projections.nextWeek.methodology, LAYOUT.margin, yPos, {
				width: LAYOUT.contentWidth,
				lineGap: 3,
			});

		// ========== TOP SERVICES ANALYSIS PAGE ==========
		if (data.topServices.length > 0) {
			doc.addPage();
			yPos = this.drawSectionHeader(doc, 'Top Services Analysis', 0);

			// Table headers and rows
			const headers = ['Service', 'Current Week', 'Change %', 'Monthly Projection'];
			const columnWidths = [200, 120, 90, 120];
			const rows = data.topServices.map((service) => {
				const changeColor =
					service.changePercent > 0 ? COLORS.danger : COLORS.success;
				return [
					service.name,
					service.currentWeekFormatted,
					`${service.changeFormatted}`,
					service.monthlyFormatted,
				];
			});

			yPos = this.drawDataTable(doc, LAYOUT.margin, yPos, headers, rows, columnWidths);
			yPos += LAYOUT.elementSpacing;

			// Color-code change percentages in the table
			let rowY = yPos - (rows.length * LAYOUT.tableRowHeight);
			rows.forEach((row, index) => {
				const service = data.topServices[index];
				const changeColor =
					service.changePercent > 0 ? COLORS.danger : COLORS.success;
				doc.fontSize(10)
					.fillColor(changeColor)
					.font('Helvetica-Bold')
					.text(
						row[2],
						LAYOUT.margin + columnWidths[0] + columnWidths[1] + LAYOUT.boxPadding,
						rowY + 7,
						{ width: columnWidths[2] - LAYOUT.boxPadding * 2 },
					);
				rowY += LAYOUT.tableRowHeight;
			});
		}

		// ========== SUMMARY STATISTICS PAGE ==========
		doc.addPage();
		yPos = this.drawSectionHeader(doc, 'Summary Statistics', 0);

		// Statistics table
		const statsHeaders = ['Metric', 'Value'];
		const statsColumnWidths = [300, 212];
		const statsRows = [
			['Last Week Cost', data.costSummary.lastWeek.formatted],
			['Previous Week Cost', data.costSummary.previousWeek.formatted],
			[
				'Week-over-Week Change',
				`${data.costSummary.change.formatted} (${data.costSummary.change.amount > 0 ? '+' : ''}$${Math.abs(data.costSummary.change.amount).toFixed(2)})`,
			],
			['Next Week Projection', data.projections.nextWeek.formatted],
			['Monthly Projection', data.projections.monthly.formatted],
			[
				'Monthly Trend',
				`${data.projections.monthly.trendDescription} (${data.projections.monthly.trend})`,
			],
			['Total Issues', data.redFlags.total.toString()],
			['Critical Issues', data.redFlags.summary.critical.toString()],
			['Warning Issues', data.redFlags.summary.warning.toString()],
			['Info Issues', data.redFlags.summary.info.toString()],
			[
				'Potential Monthly Savings',
				data.redFlags.totalPotentialSavingsFormatted,
			],
			[
				'Cost Anomalies',
				data.redFlags.byCategory.costAnomalies.toString(),
			],
			[
				'Resource Waste',
				data.redFlags.byCategory.resourceWaste.toString(),
			],
			[
				'Security Risks',
				data.redFlags.byCategory.securityRisks.toString(),
			],
			[
				'Deployment Failures',
				data.redFlags.byCategory.deploymentFailures.toString(),
			],
		];

		yPos = this.drawDataTable(
			doc,
			LAYOUT.margin,
			yPos,
			statsHeaders,
			statsRows,
			statsColumnWidths,
		);

		// ========== RED FLAGS PAGE ==========
		doc.addPage();
		yPos = this.drawSectionHeader(doc, 'Issues & Recommendations', 0);

		// Summary boxes
		const summaryBoxWidth = 180;
		const summaryBoxHeight = 60;

		this.drawBox(
			doc,
			LAYOUT.margin,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.danger,
			`Critical\n${data.redFlags.summary.critical}`,
		);

		this.drawBox(
			doc,
			LAYOUT.margin + summaryBoxWidth + 15,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.warning,
			`Warnings\n${data.redFlags.summary.warning}`,
		);

		this.drawBox(
			doc,
			LAYOUT.margin + (summaryBoxWidth + 15) * 2,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.info,
			`Info\n${data.redFlags.summary.info}`,
		);

		yPos += summaryBoxHeight + LAYOUT.sectionSpacing;

		// Potential savings
		doc.fontSize(16)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Potential Monthly Savings', LAYOUT.margin, yPos);
		yPos += 25;

		const [sr, sg, sb] = this.hexToRgb(COLORS.success);
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 50)
			.fillColor(`rgb(${sr},${sg},${sb})`)
			.fillOpacity(0.1)
			.fill();
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 50)
			.strokeColor(COLORS.success)
			.lineWidth(2)
			.stroke();

		doc.fontSize(24)
			.fillColor(COLORS.success)
			.font('Helvetica-Bold')
			.text(data.redFlags.totalPotentialSavingsFormatted, LAYOUT.margin + LAYOUT.boxPadding, yPos + 10, {
				width: LAYOUT.contentWidth - LAYOUT.boxPadding * 2,
				align: 'center',
			});

		yPos += 70;

		// Category breakdown
		doc.fontSize(14)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Issues by Category', LAYOUT.margin, yPos);
		yPos += LAYOUT.elementSpacing;

		const categoryHeaders = ['Category', 'Count'];
		const categoryColumnWidths = [350, 162];
		const categoryRows = [
			['Cost Anomalies', data.redFlags.byCategory.costAnomalies.toString()],
			['Resource Waste', data.redFlags.byCategory.resourceWaste.toString()],
			['Security Risks', data.redFlags.byCategory.securityRisks.toString()],
			[
				'Deployment Failures',
				data.redFlags.byCategory.deploymentFailures.toString(),
			],
		];

		yPos = this.drawDataTable(
			doc,
			LAYOUT.margin,
			yPos,
			categoryHeaders,
			categoryRows,
			categoryColumnWidths,
		);

		yPos += LAYOUT.sectionSpacing;

		// Individual red flags - ALL of them
		if (data.redFlags.items.length > 0) {
			doc.fontSize(16)
				.fillColor(COLORS.textDark)
				.font('Helvetica-Bold')
				.text('Detailed Issues', LAYOUT.margin, yPos);
			yPos += LAYOUT.elementSpacing + 5;

			data.redFlags.items.forEach((flag, index) => {
				yPos = this.addPageBreak(doc, yPos, 100);

				const severityColors = {
					critical: COLORS.danger,
					warning: COLORS.warning,
					info: COLORS.info,
				};

				const [cr, cg, cb] = this.hexToRgb(severityColors[flag.severity]);

				// Issue card
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 100)
					.fillColor(`rgb(${cr},${cg},${cb})`)
					.fillOpacity(0.1)
					.fill();
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 100)
					.strokeColor(severityColors[flag.severity])
					.lineWidth(2)
					.stroke();

				// Severity badge
				doc.rect(LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding, 80, 20)
					.fillColor(`rgb(${cr},${cg},${cb})`)
					.fill();
				doc.fontSize(10)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text(flag.severity.toUpperCase(), LAYOUT.margin + LAYOUT.boxPadding + 5, yPos + LAYOUT.boxPadding + 5);

				// Title
				doc.fontSize(12)
					.fillColor(COLORS.textDark)
					.font('Helvetica-Bold')
					.text(flag.title, LAYOUT.margin + LAYOUT.boxPadding + 90, yPos + LAYOUT.boxPadding, {
						width: LAYOUT.contentWidth - 200,
					});

				// Category
				doc.fontSize(9)
					.fillColor(COLORS.textLight)
					.font('Helvetica')
					.text(`Category: ${flag.category}`, LAYOUT.margin + LAYOUT.boxPadding + 90, yPos + LAYOUT.boxPadding + 18);

				// Description
				doc.fontSize(10)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(flag.description, LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding + 40, {
						width: LAYOUT.contentWidth - LAYOUT.boxPadding * 2,
						lineGap: 2,
					});

				// Details row
				let detailY = yPos + LAYOUT.boxPadding + 75;
				let detailX = LAYOUT.margin + LAYOUT.boxPadding;

				if (flag.resourceId) {
					doc.fontSize(9)
						.fillColor(COLORS.textLight)
						.font('Helvetica')
						.text(`Resource ID: ${flag.resourceId}`, detailX, detailY);
					detailX += 150;
				}

				if (flag.resourceType) {
					doc.fontSize(9)
						.fillColor(COLORS.textLight)
						.font('Helvetica')
						.text(`Type: ${flag.resourceType}`, detailX, detailY);
					detailX += 120;
				}

				if (flag.estimatedSavingsFormatted) {
					doc.fontSize(10)
						.fillColor(COLORS.success)
						.font('Helvetica-Bold')
						.text(`Savings: ${flag.estimatedSavingsFormatted}`, detailX, detailY);
				}

				// Detection date
				doc.fontSize(9)
					.fillColor(COLORS.textLight)
					.font('Helvetica')
					.text(
						`Detected: ${new Date(flag.detectedAt).toLocaleDateString()}`,
						LAYOUT.margin + LAYOUT.contentWidth - 180,
						yPos + LAYOUT.boxPadding,
					);

				// Auto-fixable indicator
				if (flag.autoFixable && flag.fixCommand) {
					doc.fontSize(9)
						.fillColor(COLORS.info)
						.font('Helvetica-Bold')
						.text(
							`Auto-fixable: ${flag.fixCommand}`,
							LAYOUT.margin + LAYOUT.boxPadding,
							yPos + 95,
						);
				}

				yPos += 110 + LAYOUT.cardSpacing;
			});
		}

		// ========== LEARNING INSIGHTS PAGE ==========
		if (data.learningInsights.length > 0) {
			doc.addPage();
			yPos = this.drawSectionHeader(doc, 'Learning Insights', 0);

			data.learningInsights.forEach((insight) => {
				yPos = this.addPageBreak(doc, yPos, 80);

				// Insight card
				const [ir, ig, ib] = this.hexToRgb(COLORS.info);
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
					.fillColor(`rgb(${ir},${ig},${ib})`)
					.fillOpacity(0.05)
					.fill();
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
					.strokeColor(COLORS.border)
					.lineWidth(1)
					.stroke();

				// Type badge
				doc.rect(LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding, 80, 18)
					.fillColor(`rgb(${ir},${ig},${ib})`)
					.fill();
				doc.fontSize(9)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text(insight.type.toUpperCase(), LAYOUT.margin + LAYOUT.boxPadding + 5, yPos + LAYOUT.boxPadding + 4);

				// Message
				doc.fontSize(11)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(insight.message, LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding + 25, {
						width: LAYOUT.contentWidth - LAYOUT.boxPadding * 2,
						lineGap: 2,
					});

				// Confidence and source
				doc.fontSize(9)
					.fillColor(COLORS.textLight)
					.font('Helvetica')
					.text(
						`Confidence: ${insight.confidenceFormatted} | Source: ${insight.source}`,
						LAYOUT.margin + LAYOUT.boxPadding,
						yPos + 60,
					);

				yPos += 80 + LAYOUT.cardSpacing;
			});
		}

		// ========== RECOMMENDATIONS PAGE ==========
		if (data.recommendations.length > 0) {
			doc.addPage();
			yPos = this.drawSectionHeader(doc, 'Recommendations', 0);

			data.recommendations.forEach((rec, index) => {
				yPos = this.addPageBreak(doc, yPos, 70);

				// Recommendation card
				const [rr, rg, rb] = this.hexToRgb(COLORS.info);
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 60)
					.fillColor(`rgb(${rr},${rg},${rb})`)
					.fillOpacity(0.05)
					.fill();
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 60)
					.strokeColor(COLORS.border)
					.lineWidth(1)
					.stroke();

				// Number badge
				doc.circle(LAYOUT.margin + 25, yPos + 30, 12)
					.fillColor(`rgb(${rr},${rg},${rb})`)
					.fill();
				doc.fontSize(12)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text((index + 1).toString(), LAYOUT.margin + 19, yPos + 23, {
						width: 12,
						align: 'center',
					});

				// Recommendation text
				doc.fontSize(11)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(rec, LAYOUT.margin + 45, yPos + 18, {
						width: LAYOUT.contentWidth - 60,
						lineGap: 3,
					});

				yPos += 70 + LAYOUT.cardSpacing;
			});
		}

		// Footer on last page
		this.drawFooter(doc, LAYOUT.pageBottom, data.metadata.reportId);
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

		this.generateFullPDFContent(doc, data);

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

			this.generateFullPDFContent(doc, data);

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
			console.warn(`Failed to cleanup PDF: ${pdfPath}`, error);
		}
	}
}
