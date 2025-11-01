/**
 * PDF Generator Service
 * Professional PDF report generation with proper text visibility, spacing, and design
 */

import PDFDocument from 'pdfkit';
import type { PDFReportData } from '../utils/report-formatter.js';
import fs from 'fs';
import path from 'path';

// Professional color scheme with high contrast
const COLORS = {
	primary: '#2563eb', // Blue
	secondary: '#7c3aed', // Purple
	success: '#16a34a', // Green
	warning: '#ea580c', // Orange
	danger: '#dc2626', // Red
	info: '#0891b2', // Cyan
	bgLight: '#f8fafc',
	bgPrimary: '#1e40af',
	textDark: '#0f172a', // Very dark for high contrast
	textMedium: '#475569',
	textLight: '#64748b',
	border: '#cbd5e1',
	chart1: '#3b82f6', // Blue
	chart2: '#8b5cf6', // Purple
	chart3: '#10b981', // Green
	chart4: '#f59e0b', // Amber
	chart5: '#ef4444', // Red
	chart6: '#06b6d4', // Cyan
};

// Layout constants - optimized for readability and no wasted space
const LAYOUT = {
	margin: 50,
	contentWidth: 512,
	sectionSpacing: 20,
	elementSpacing: 10,
	lineHeight: 1.4,
	headingLineHeight: 1.3,
	boxPadding: 12,
	tableRowHeight: 26,
	cardSpacing: 12,
	pageBottom: 750,
	headerHeight: 65,
	minFontSize: 10,
	bodyFontSize: 11,
	headingFontSize: 16,
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
		
		// Header background
		doc.rect(0, y, 612, LAYOUT.headerHeight)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();

		// Title text - ensure it's visible with white color
		doc.fontSize(22)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text(title, LAYOUT.margin, y + 22);

		return y + LAYOUT.headerHeight + 10;
	}

	/**
	 * Draw labeled field with proper spacing and high contrast colors
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
			bold?: boolean;
		},
	): number {
		const labelWidth = options?.labelWidth || 140;
		const labelSize = options?.labelSize || LAYOUT.minFontSize;
		const valueSize = options?.valueSize || LAYOUT.bodyFontSize;
		const valueColor = options?.valueColor || COLORS.textDark;
		const bold = options?.bold !== false;

		// Label - always use textLight for labels
		doc.fontSize(labelSize)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(label, x, y);

		// Value - use specified color with high contrast
		doc.fontSize(valueSize)
			.fillColor(valueColor)
			.font(bold ? 'Helvetica-Bold' : 'Helvetica')
			.text(value, x + labelWidth, y, {
				width: LAYOUT.contentWidth - labelWidth - LAYOUT.margin,
			});

		return y + Math.max(valueSize, labelSize) * 1.3 + 8;
	}

	/**
	 * Draw a colored box with text - ensure text is always visible
	 */
	private static drawBox(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		width: number,
		height: number,
		color: string,
		label?: string,
		value?: string,
		textColor: string = '#ffffff',
	): void {
		const [r, g, b] = this.hexToRgb(color);
		
		// Draw background first
		doc.rect(x, y, width, height)
			.fillColor(`rgb(${r},${g},${b})`)
			.fill();
		
		// Draw border
		doc.rect(x, y, width, height)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		// Draw text AFTER background to ensure visibility
		if (label || value) {
			const [tcR, tcG, tcB] = this.hexToRgb(textColor);
			const centerY = y + height / 2;
			
			if (label) {
				doc.fontSize(11)
					.fillColor(`rgb(${tcR},${tcG},${tcB})`)
					.font('Helvetica')
					.text(label, x + LAYOUT.boxPadding, centerY - 12, {
						width: width - LAYOUT.boxPadding * 2,
						align: 'center',
					});
			}
			
			if (value) {
				doc.fontSize(20)
					.fillColor(`rgb(${tcR},${tcG},${tcB})`)
					.font('Helvetica-Bold')
					.text(value, x + LAYOUT.boxPadding, centerY + 2, {
						width: width - LAYOUT.boxPadding * 2,
						align: 'center',
					});
			}
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
		
		// Background with light opacity
		doc.rect(x, y, width, height)
			.fillColor(`rgb(${r},${g},${b})`)
			.fillOpacity(0.15)
			.fill();
		
		// Border
		doc.rect(x, y, width, height)
			.strokeColor(color)
			.lineWidth(2)
			.stroke();

		// Label - always dark text for visibility
		doc.fontSize(10)
			.fillColor(COLORS.textLight)
			.font('Helvetica')
			.text(label, x + LAYOUT.boxPadding, y + LAYOUT.boxPadding);

		// Value - use the accent color
		doc.fontSize(20)
			.fillColor(color)
			.font('Helvetica-Bold')
			.text(value, x + LAYOUT.boxPadding, y + LAYOUT.boxPadding + 12);

		// Subtext if provided
		if (subtext) {
			doc.fontSize(9)
				.fillColor(COLORS.textMedium)
				.font('Helvetica')
				.text(subtext, x + LAYOUT.boxPadding, y + height - 20, {
					width: width - LAYOUT.boxPadding * 2,
				});
		}
	}

	/**
	 * Draw data table with high contrast and proper spacing
	 */
	private static drawDataTable(
		doc: PDFKit.PDFDocument,
		x: number,
		y: number,
		headers: string[],
		rows: string[][],
		columnWidths: number[],
	): number {
		const headerHeight = 32;
		const rowHeight = LAYOUT.tableRowHeight;
		const totalWidth = columnWidths.reduce((a, b) => a + b, 0);

		// Header background - solid color for visibility
		const [pr, pg, pb] = this.hexToRgb(COLORS.primary);
		doc.rect(x, y, totalWidth, headerHeight)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();
		
		doc.rect(x, y, totalWidth, headerHeight)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();

		// Headers - white text on colored background
		let currentX = x + LAYOUT.boxPadding;
		doc.fontSize(11)
			.fillColor('white')
			.font('Helvetica-Bold');
		headers.forEach((header, index) => {
			doc.text(header, currentX, y + 9, {
				width: columnWidths[index] - LAYOUT.boxPadding * 2,
			});
			currentX += columnWidths[index];
		});

		let currentY = y + headerHeight;

		// Rows with alternating colors for readability
		rows.forEach((row, rowIndex) => {
			// Alternating row backgrounds - subtle
			if (rowIndex % 2 === 0) {
				const [bgR, bgG, bgB] = this.hexToRgb(COLORS.bgLight);
				doc.rect(x, currentY, totalWidth, rowHeight)
					.fillColor(`rgb(${bgR},${bgG},${bgB})`)
					.fill();
			}

			// Row border
			doc.rect(x, currentY, totalWidth, rowHeight)
				.strokeColor(COLORS.border)
				.lineWidth(0.5)
				.stroke();

			// Row content - always dark text
			currentX = x + LAYOUT.boxPadding;
			doc.fontSize(LAYOUT.bodyFontSize)
				.fillColor(COLORS.textDark)
				.font('Helvetica');
			row.forEach((cell, cellIndex) => {
				doc.text(cell, currentX, currentY + 8, {
					width: columnWidths[cellIndex] - LAYOUT.boxPadding * 2,
				});
				currentX += columnWidths[cellIndex];
			});

			currentY += rowHeight;
		});

		return currentY;
	}

	/**
	 * Draw a bar chart with vibrant colors and proper labels
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
		// Title - dark text, bold
		doc.fontSize(LAYOUT.headingFontSize - 2)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(title, x, y, { width });

		const chartY = y + 25;
		const chartHeight = height - 50;
		const chartWidth = width - 50;
		const barWidth = Math.max(40, chartWidth / data.labels.length - 12);
		const maxBarHeight = chartHeight - 30;

		// Draw axes with darker color
		doc.strokeColor(COLORS.textMedium)
			.lineWidth(1.5);
		// Y-axis
		doc.moveTo(x + 40, chartY)
			.lineTo(x + 40, chartY + chartHeight)
			.stroke();
		// X-axis
		doc.moveTo(x + 40, chartY + chartHeight)
			.lineTo(x + 40 + chartWidth, chartY + chartHeight)
			.stroke();

		// Chart colors - vibrant and distinct
		const chartColors = [
			COLORS.chart1,
			COLORS.chart2,
			COLORS.chart3,
			COLORS.chart4,
			COLORS.chart5,
			COLORS.chart6,
		];

		// Draw bars
		data.labels.forEach((label, index) => {
			const barHeight = (data.values[index] / data.maxValue) * maxBarHeight;
			const barX = x + 50 + index * (barWidth + 12);
			const barY = chartY + chartHeight - barHeight;

			const [r, g, b] = this.hexToRgb(chartColors[index % chartColors.length]);

			// Bar with gradient effect (darker bottom, lighter top)
			doc.rect(barX, barY, barWidth, barHeight)
				.fillColor(`rgb(${r},${g},${b})`)
				.fill();

			// Bar value on top - always visible
			if (barHeight > 18) {
				doc.fontSize(9)
					.fillColor(COLORS.textDark)
					.font('Helvetica-Bold')
					.text(`$${data.values[index].toFixed(0)}`, barX, barY - 14, {
						width: barWidth,
						align: 'center',
					});
			}

			// Label below - dark text
			doc.fontSize(9)
				.fillColor(COLORS.textDark)
				.font('Helvetica')
				.text(label, barX, chartY + chartHeight + 5, {
					width: barWidth,
					align: 'center',
				});
		});
	}

	/**
	 * Draw a pie chart (donut chart) with vibrant colors
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
		doc.fontSize(LAYOUT.headingFontSize - 2)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(title, x, y, { width: radius * 2 });

		const centerX = x + radius;
		const centerY = y + 30 + radius;
		const total = data.values.reduce((sum, val) => sum + val, 0);

		// Chart colors - vibrant palette
		const chartColors = [
			COLORS.chart1,
			COLORS.chart2,
			COLORS.chart3,
			COLORS.chart4,
			COLORS.chart5,
			COLORS.chart6,
		];

		let currentAngle = -90;

		data.labels.forEach((label, index) => {
			const percentage = data.values[index] / total;
			const angle = percentage * 360;
			const [r, g, b] = this.hexToRgb(chartColors[index % chartColors.length]);

			// Draw segment
			if (percentage > 0.01) { // Only draw if > 1%
				const endX = centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180);
				const endY = centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180);
				
				doc.path(
					`M ${centerX} ${centerY} L ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${angle > 180 ? 1 : 0} 1 ${endX} ${endY} Z`,
				)
					.fillColor(`rgb(${r},${g},${b})`)
					.fill();

				// Legend with color indicator
				const legendX = x + radius * 2 + 20;
				const legendY = y + 30 + index * 22;
				
				// Color square
				doc.rect(legendX, legendY, 12, 12)
					.fillColor(`rgb(${r},${g},${b})`)
					.fill();
				doc.rect(legendX, legendY, 12, 12)
					.strokeColor(COLORS.border)
					.lineWidth(0.5)
					.stroke();
				
				// Legend text - dark for visibility
				doc.fontSize(9)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(
						`${label}: $${data.values[index].toFixed(2)} (${(percentage * 100).toFixed(1)}%)`,
						legendX + 18,
						legendY - 1,
					);
			}

			currentAngle += angle;
		});

		// Center circle (donut effect)
		doc.circle(centerX, centerY, radius * 0.55)
			.fillColor('white')
			.fill();
		doc.circle(centerX, centerY, radius * 0.55)
			.strokeColor(COLORS.border)
			.lineWidth(1)
			.stroke();
		
		// Total in center
		doc.fontSize(12)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text(`Total`, centerX - 20, centerY - 10, {
				width: 40,
				align: 'center',
			});
		doc.fontSize(11)
			.fillColor(COLORS.primary)
			.font('Helvetica-Bold')
			.text(`$${total.toFixed(2)}`, centerX - 25, centerY + 2, {
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
		size: number = 22,
	): void {
		const color =
			direction === 'up'
				? COLORS.danger
				: direction === 'down'
					? COLORS.success
					: COLORS.textMedium;

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
	 * Add page break if needed
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
	 * Draw footer
	 */
	private static drawFooter(
		doc: PDFKit.PDFDocument,
		y: number,
		reportId?: string,
	): void {
		doc.fontSize(9)
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
		let yPos = LAYOUT.margin;

		// ========== COVER PAGE ==========
		const [pr, pg, pb] = this.hexToRgb(COLORS.bgPrimary);
		doc.rect(0, 0, 612, 130)
			.fillColor(`rgb(${pr},${pg},${pb})`)
			.fill();

		// Title - white text on colored background
		doc.fontSize(34)
			.fillColor('white')
			.font('Helvetica-Bold')
			.text('Cloudable', LAYOUT.margin, 45, {
				width: LAYOUT.contentWidth,
				align: 'center',
			});

		doc.fontSize(20)
			.fillColor('white')
			.font('Helvetica')
			.text('Cost Analysis Report', LAYOUT.margin, 80, {
				width: LAYOUT.contentWidth,
				align: 'center',
			});

		// Metadata box
		const boxY = 150;
		const [bgR, bgG, bgB] = this.hexToRgb(COLORS.bgLight);
		doc.rect(LAYOUT.margin, boxY, LAYOUT.contentWidth, 130)
			.fillColor(`rgb(${bgR},${bgG},${bgB})`)
			.fill();
		doc.rect(LAYOUT.margin, boxY, LAYOUT.contentWidth, 130)
			.strokeColor(COLORS.border)
			.lineWidth(1.5)
			.stroke();

		yPos = boxY + LAYOUT.boxPadding;
		yPos = this.drawLabeledField(
			doc,
			'Report ID:',
			data.metadata.reportId,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
			{ labelWidth: 130 },
		);
		yPos = this.drawLabeledField(
			doc,
			'Deployment:',
			data.metadata.deploymentId,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
			{ labelWidth: 130 },
		);
		yPos = this.drawLabeledField(
			doc,
			'Generated:',
			new Date(data.metadata.generatedAt).toLocaleString(),
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
			{ labelWidth: 130 },
		);
		this.drawLabeledField(
			doc,
			'Billing Period:',
			`${new Date(data.metadata.billingPeriod.start).toLocaleDateString()} - ${new Date(data.metadata.billingPeriod.end).toLocaleDateString()}`,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos,
			{ labelWidth: 130 },
		);

		// ========== EXECUTIVE SUMMARY PAGE ==========
		doc.addPage();
		yPos = this.drawSectionHeader(doc, 'Executive Summary', 0);

		// Cost comparison boxes
		const boxWidth = 165;
		const boxHeight = 75;
		const spacing = 15;

		this.drawBox(
			doc,
			LAYOUT.margin,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.primary,
			'Last Week',
			data.costSummary.lastWeek.formatted,
		);

		this.drawBox(
			doc,
			LAYOUT.margin + boxWidth + spacing,
			yPos,
			boxWidth,
			boxHeight,
			COLORS.secondary,
			'Previous Week',
			data.costSummary.previousWeek.formatted,
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
			'Change',
			data.costSummary.change.formatted,
		);

		this.drawTrendIndicator(
			doc,
			changeBoxX + boxWidth - 32,
			yPos + 22,
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
			'Monthly Projection',
			data.projections.monthly.formatted,
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
			'Issues Detected',
			`${data.redFlags.total} total`,
		);

		yPos += boxHeight + LAYOUT.sectionSpacing;

		// Charts side by side
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
			this.drawBarChart(doc, LAYOUT.margin, yPos, 250, 160, chartData, 'Weekly Cost Comparison');
		}

		if (data.topServices.length > 0) {
			const serviceData: ChartData = {
				labels: data.topServices.slice(0, 5).map((s) => s.name),
				values: data.topServices.slice(0, 5).map((s) => s.currentWeekCost),
				maxValue: Math.max(
					...data.topServices.slice(0, 5).map((s) => s.currentWeekCost),
				),
			};
			this.drawPieChart(doc, 330, yPos, 75, serviceData, 'Top Services Breakdown');
		}

		// ========== COST PROJECTIONS PAGE ==========
		doc.addPage();
		yPos = this.drawSectionHeader(doc, 'Cost Projections', 0);

		// Next week projection
		doc.fontSize(LAYOUT.headingFontSize)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Next Week Prediction', LAYOUT.margin, yPos);
		yPos += 22;

		const [nr, ng, nb] = this.hexToRgb(COLORS.info);
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 75)
			.fillColor(`rgb(${nr},${ng},${nb})`)
			.fillOpacity(0.12)
			.fill();
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 75)
			.strokeColor(COLORS.info)
			.lineWidth(2)
			.stroke();

		doc.fontSize(30)
			.fillColor(COLORS.info)
			.font('Helvetica-Bold')
			.text(data.projections.nextWeek.formatted, LAYOUT.margin + LAYOUT.boxPadding, yPos + 18);

		yPos = this.drawLabeledField(
			doc,
			'Confidence Interval:',
			data.projections.nextWeek.confidenceInterval.formatted,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos + 50,
			{ labelWidth: 150, valueColor: COLORS.textDark },
		);

		yPos += LAYOUT.sectionSpacing;

		// Monthly projection
		doc.fontSize(LAYOUT.headingFontSize)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Monthly Projection', LAYOUT.margin, yPos);
		yPos += 22;

		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 75)
			.fillColor(`rgb(${nr},${ng},${nb})`)
			.fillOpacity(0.12)
			.fill();
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 75)
			.strokeColor(COLORS.info)
			.lineWidth(2)
			.stroke();

		doc.fontSize(30)
			.fillColor(COLORS.info)
			.font('Helvetica-Bold')
			.text(data.projections.monthly.formatted, LAYOUT.margin + LAYOUT.boxPadding, yPos + 18);

		this.drawTrendIndicator(
			doc,
			LAYOUT.margin + LAYOUT.contentWidth - 50,
			yPos + 22,
			data.projections.monthly.trend === 'increasing'
				? 'up'
				: data.projections.monthly.trend === 'decreasing'
					? 'down'
					: 'neutral',
			28,
		);

		yPos = this.drawLabeledField(
			doc,
			'Trend:',
			data.projections.monthly.trendDescription,
			LAYOUT.margin + LAYOUT.boxPadding,
			yPos + 50,
			{ labelWidth: 150, valueColor: COLORS.textDark },
		);

		yPos += LAYOUT.sectionSpacing;

		// Methodology
		doc.fontSize(14)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Methodology', LAYOUT.margin, yPos);
		yPos += LAYOUT.elementSpacing;

		doc.fontSize(LAYOUT.bodyFontSize)
			.fillColor(COLORS.textMedium)
			.font('Helvetica')
			.text(data.projections.nextWeek.methodology, LAYOUT.margin, yPos, {
				width: LAYOUT.contentWidth,
				lineGap: 4,
			});

		// ========== TOP SERVICES ANALYSIS PAGE ==========
		if (data.topServices.length > 0) {
			doc.addPage();
			yPos = this.drawSectionHeader(doc, 'Top Services Analysis', 0);

			// Table
			const headers = ['Service', 'Current Week', 'Change %', 'Monthly Projection'];
			const columnWidths = [190, 120, 95, 117];
			const rows = data.topServices.map((service) => [
				service.name,
				service.currentWeekFormatted,
				service.changeFormatted,
				service.monthlyFormatted,
			]);

			yPos = this.drawDataTable(doc, LAYOUT.margin, yPos, headers, rows, columnWidths);

			// Color-code change percentages
			let rowY = yPos - (rows.length * LAYOUT.tableRowHeight);
			rows.forEach((_, index) => {
				const service = data.topServices[index];
				const changeColor =
					service.changePercent > 0 ? COLORS.danger : COLORS.success;
				doc.fontSize(LAYOUT.bodyFontSize)
					.fillColor(changeColor)
					.font('Helvetica-Bold')
					.text(
						service.changeFormatted,
						LAYOUT.margin + columnWidths[0] + columnWidths[1] + LAYOUT.boxPadding,
						rowY + 8,
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
		const statsColumnWidths = [280, 232];
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
		const summaryBoxWidth = 175;
		const summaryBoxHeight = 55;

		this.drawBox(
			doc,
			LAYOUT.margin,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.danger,
			'Critical',
			data.redFlags.summary.critical.toString(),
		);

		this.drawBox(
			doc,
			LAYOUT.margin + summaryBoxWidth + 15,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.warning,
			'Warnings',
			data.redFlags.summary.warning.toString(),
		);

		this.drawBox(
			doc,
			LAYOUT.margin + (summaryBoxWidth + 15) * 2,
			yPos,
			summaryBoxWidth,
			summaryBoxHeight,
			COLORS.info,
			'Info',
			data.redFlags.summary.info.toString(),
		);

		yPos += summaryBoxHeight + LAYOUT.sectionSpacing;

		// Potential savings
		doc.fontSize(LAYOUT.headingFontSize)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Potential Monthly Savings', LAYOUT.margin, yPos);
		yPos += 22;

		const [sr, sg, sb] = this.hexToRgb(COLORS.success);
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 50)
			.fillColor(`rgb(${sr},${sg},${sb})`)
			.fillOpacity(0.15)
			.fill();
		doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 50)
			.strokeColor(COLORS.success)
			.lineWidth(2.5)
			.stroke();

		doc.fontSize(26)
			.fillColor(COLORS.success)
			.font('Helvetica-Bold')
			.text(data.redFlags.totalPotentialSavingsFormatted, LAYOUT.margin + LAYOUT.boxPadding, yPos + 8, {
				width: LAYOUT.contentWidth - LAYOUT.boxPadding * 2,
				align: 'center',
			});

		yPos += 70;

		// Category breakdown
		doc.fontSize(14)
			.fillColor(COLORS.textDark)
			.font('Helvetica-Bold')
			.text('Issues by Category', LAYOUT.margin, yPos);
		yPos += LAYOUT.elementSpacing + 2;

		const categoryHeaders = ['Category', 'Count'];
		const categoryColumnWidths = [330, 182];
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
			doc.fontSize(LAYOUT.headingFontSize)
				.fillColor(COLORS.textDark)
				.font('Helvetica-Bold')
				.text('Detailed Issues', LAYOUT.margin, yPos);
			yPos += LAYOUT.elementSpacing + 5;

			data.redFlags.items.forEach((flag) => {
				yPos = this.addPageBreak(doc, yPos, 110);

				const severityColors = {
					critical: COLORS.danger,
					warning: COLORS.warning,
					info: COLORS.info,
				};

				const [cr, cg, cb] = this.hexToRgb(severityColors[flag.severity]);

				// Issue card
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 95)
					.fillColor(`rgb(${cr},${cg},${cb})`)
					.fillOpacity(0.12)
					.fill();
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 95)
					.strokeColor(severityColors[flag.severity])
					.lineWidth(2)
					.stroke();

				// Severity badge
				doc.rect(LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding, 75, 20)
					.fillColor(`rgb(${cr},${cg},${cb})`)
					.fill();
				doc.fontSize(10)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text(flag.severity.toUpperCase(), LAYOUT.margin + LAYOUT.boxPadding + 5, yPos + LAYOUT.boxPadding + 5);

				// Title - dark text for visibility
				doc.fontSize(12)
					.fillColor(COLORS.textDark)
					.font('Helvetica-Bold')
					.text(flag.title, LAYOUT.margin + LAYOUT.boxPadding + 85, yPos + LAYOUT.boxPadding, {
						width: LAYOUT.contentWidth - 200,
					});

				// Category
				doc.fontSize(9)
					.fillColor(COLORS.textMedium)
					.font('Helvetica')
					.text(`Category: ${flag.category}`, LAYOUT.margin + LAYOUT.boxPadding + 85, yPos + LAYOUT.boxPadding + 16);

				// Description - dark text
				doc.fontSize(LAYOUT.bodyFontSize)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(flag.description, LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding + 40, {
						width: LAYOUT.contentWidth - LAYOUT.boxPadding * 2,
						lineGap: 3,
					});

				// Details row
				let detailY = yPos + LAYOUT.boxPadding + 70;
				let detailX = LAYOUT.margin + LAYOUT.boxPadding;

				if (flag.resourceId) {
					doc.fontSize(9)
						.fillColor(COLORS.textMedium)
						.font('Helvetica')
						.text(`Resource: ${flag.resourceId}`, detailX, detailY);
					detailX += 180;
				}

				if (flag.resourceType) {
					doc.fontSize(9)
						.fillColor(COLORS.textMedium)
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
							`Auto-fix: ${flag.fixCommand}`,
							LAYOUT.margin + LAYOUT.boxPadding,
							yPos + 88,
						);
				}

				yPos += 105 + LAYOUT.cardSpacing;
			});
		}

		// ========== LEARNING INSIGHTS PAGE ==========
		if (data.learningInsights.length > 0) {
			doc.addPage();
			yPos = this.drawSectionHeader(doc, 'Learning Insights', 0);

			data.learningInsights.forEach((insight) => {
				yPos = this.addPageBreak(doc, yPos, 85);

				// Insight card
				const [ir, ig, ib] = this.hexToRgb(COLORS.info);
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
					.fillColor(`rgb(${ir},${ig},${ib})`)
					.fillOpacity(0.08)
					.fill();
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 70)
					.strokeColor(COLORS.border)
					.lineWidth(1)
					.stroke();

				// Type badge
				doc.rect(LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding, 75, 18)
					.fillColor(`rgb(${ir},${ig},${ib})`)
					.fill();
				doc.fontSize(9)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text(insight.type.toUpperCase(), LAYOUT.margin + LAYOUT.boxPadding + 5, yPos + LAYOUT.boxPadding + 4);

				// Message - dark text
				doc.fontSize(LAYOUT.bodyFontSize)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(insight.message, LAYOUT.margin + LAYOUT.boxPadding, yPos + LAYOUT.boxPadding + 25, {
						width: LAYOUT.contentWidth - LAYOUT.boxPadding * 2,
						lineGap: 3,
					});

				// Confidence and source
				doc.fontSize(9)
					.fillColor(COLORS.textMedium)
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
					.fillOpacity(0.08)
					.fill();
				doc.rect(LAYOUT.margin, yPos, LAYOUT.contentWidth, 60)
					.strokeColor(COLORS.border)
					.lineWidth(1)
					.stroke();

				// Number badge
				doc.circle(LAYOUT.margin + 25, yPos + 30, 13)
					.fillColor(`rgb(${rr},${rg},${rb})`)
					.fill();
				doc.fontSize(12)
					.fillColor('white')
					.font('Helvetica-Bold')
					.text((index + 1).toString(), LAYOUT.margin + 19, yPos + 23, {
						width: 12,
						align: 'center',
					});

				// Recommendation text - dark for visibility
				doc.fontSize(LAYOUT.bodyFontSize)
					.fillColor(COLORS.textDark)
					.font('Helvetica')
					.text(rec, LAYOUT.margin + 45, yPos + 18, {
						width: LAYOUT.contentWidth - 60,
						lineGap: 4,
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
