/**
 * Cost Anomaly Detector
 * Detects unusual cost patterns, spikes, and budget overruns
 */

import type {
	RedFlag,
	CostSummary,
	CostBreakdown,
	RedFlagDetectorInput,
	RedFlagDetectorOutput,
	CostAnomalyDetectorConfig,
} from "../types/cost-monitor.js";
import { v4 as uuidv4 } from "uuid";

const DEFAULT_CONFIG: CostAnomalyDetectorConfig = {
	enabled: true,
	severity: "warning",
	thresholds: {
		weekOverWeekIncreasePercent: 20, // Flag if costs increase >20% week-over-week
		dailyBudgetLimit: undefined,
		monthlyBudgetLimit: undefined,
	},
	excludedResources: [],
	excludedTags: {},
};

/**
 * Cost Anomaly Detector
 * Identifies cost spikes, unusual patterns, and budget violations
 */
export class CostAnomalyDetector {
	private config: CostAnomalyDetectorConfig;
	private detectorId: string = "cost-anomaly-detector";
	private version: string = "1.0.0";

	constructor(config?: Partial<CostAnomalyDetectorConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Detect cost anomalies in current vs historical data
	 */
	async detect(input: RedFlagDetectorInput): Promise<RedFlagDetectorOutput> {
		const startTime = Date.now();
		const redFlags: RedFlag[] = [];

		if (!this.config.enabled) {
			return this.createOutput(redFlags, startTime, 0);
		}

		// 1. Week-over-week cost increase
		redFlags.push(...this.detectWeekOverWeekIncrease(input.costData));

		// 2. Service-specific anomalies
		redFlags.push(...this.detectServiceAnomalies(input.costData));

		// 3. Budget threshold violations
		if (this.config.thresholds.monthlyBudgetLimit) {
			redFlags.push(...this.detectBudgetViolations(input.costData));
		}

		// 4. Sudden service cost spikes
		if (input.historicalData && input.historicalData.length > 0) {
			redFlags.push(
				...this.detectSuddenSpikes(input.costData, input.historicalData),
			);
		}

		// 5. Unusual cost patterns
		if (input.historicalData && input.historicalData.length >= 4) {
			redFlags.push(
				...this.detectUnusualPatterns(input.costData, input.historicalData),
			);
		}

		const executionTime = Date.now() - startTime;
		return this.createOutput(redFlags, startTime, executionTime);
	}

	/**
	 * Detect week-over-week cost increases above threshold
	 */
	private detectWeekOverWeekIncrease(costData: CostSummary): RedFlag[] {
		const redFlags: RedFlag[] = [];
		const threshold = this.config.thresholds.weekOverWeekIncreasePercent;

		// Overall cost increase
		if (costData.totalChangePercent > threshold) {
			redFlags.push({
				id: uuidv4(),
				category: "cost_anomaly",
				severity:
					costData.totalChangePercent > threshold * 2 ? "critical" : "warning",
				title: `Weekly cost increased by ${costData.totalChangePercent.toFixed(1)}%`,
				description: `Your total AWS costs increased from $${costData.totalPreviousWeek.toFixed(2)} to $${costData.totalCurrentWeek.toFixed(2)} this week (${costData.totalChangePercent >= 0 ? "+" : ""}$${costData.totalChangeAmount.toFixed(2)}). This exceeds the ${threshold}% threshold.`,
				detectedAt: new Date().toISOString(),
				estimatedMonthlyCost: costData.monthlyProjection,
				autoFixable: false,
				metadata: {
					previousWeek: costData.totalPreviousWeek,
					currentWeek: costData.totalCurrentWeek,
					changePercent: costData.totalChangePercent,
					threshold,
				},
			});
		}

		// Per-service increases
		for (const service of costData.topServices) {
			if (service.changePercent > threshold) {
				redFlags.push({
					id: uuidv4(),
					category: "cost_anomaly",
					severity:
						service.changePercent > threshold * 2 ? "critical" : "warning",
					title: `${service.service} costs increased by ${service.changePercent.toFixed(1)}%`,
					description: `${service.service} costs jumped from $${service.previousWeekCost.toFixed(2)} to $${service.currentWeekCost.toFixed(2)} (${service.changePercent >= 0 ? "+" : ""}$${service.changeAmount.toFixed(2)}). This may indicate resource scaling, configuration changes, or unexpected usage.`,
					detectedAt: new Date().toISOString(),
					resourceType: service.service,
					estimatedMonthlyCost: service.monthlyProjection,
					autoFixable: false,
					metadata: {
						service: service.service,
						previousWeek: service.previousWeekCost,
						currentWeek: service.currentWeekCost,
						changePercent: service.changePercent,
						threshold,
					},
				});
			}
		}

		return redFlags;
	}

	/**
	 * Detect service-specific cost anomalies
	 */
	private detectServiceAnomalies(costData: CostSummary): RedFlag[] {
		const redFlags: RedFlag[] = [];

		for (const service of costData.topServices) {
			// Detect disproportionate service costs
			const servicePercentOfTotal =
				(service.currentWeekCost / costData.totalCurrentWeek) * 100;

			// Flag if a single service is >70% of total costs (potential misconfiguration)
			if (servicePercentOfTotal > 70) {
				redFlags.push({
					id: uuidv4(),
					category: "cost_anomaly",
					severity: "warning",
					title: `${service.service} represents ${servicePercentOfTotal.toFixed(1)}% of total costs`,
					description: `${service.service} is consuming an unusually large portion of your AWS budget ($${service.currentWeekCost.toFixed(2)} of $${costData.totalCurrentWeek.toFixed(2)}). This may indicate over-provisioning or a need to diversify your infrastructure.`,
					detectedAt: new Date().toISOString(),
					resourceType: service.service,
					estimatedMonthlyCost: service.monthlyProjection,
					autoFixable: false,
					metadata: {
						service: service.service,
						percentOfTotal: servicePercentOfTotal,
						currentWeekCost: service.currentWeekCost,
					},
				});
			}

			// Detect new expensive services (>$20/week and didn't exist last week)
			if (service.currentWeekCost > 20 && service.previousWeekCost === 0) {
				redFlags.push({
					id: uuidv4(),
					category: "cost_anomaly",
					severity: "info",
					title: `New service detected: ${service.service}`,
					description: `${service.service} appeared this week with costs of $${service.currentWeekCost.toFixed(2)}. If this was intentional, no action needed. Otherwise, review recent deployments.`,
					detectedAt: new Date().toISOString(),
					resourceType: service.service,
					estimatedMonthlyCost: service.monthlyProjection,
					autoFixable: false,
					metadata: {
						service: service.service,
						currentWeekCost: service.currentWeekCost,
						isNewService: true,
					},
				});
			}
		}

		return redFlags;
	}

	/**
	 * Detect budget threshold violations
	 */
	private detectBudgetViolations(costData: CostSummary): RedFlag[] {
		const redFlags: RedFlag[] = [];
		const monthlyBudget = this.config.thresholds.monthlyBudgetLimit!;

		// Check if monthly projection exceeds budget
		if (costData.monthlyProjection > monthlyBudget) {
			const overagePercent =
				((costData.monthlyProjection - monthlyBudget) / monthlyBudget) * 100;

			redFlags.push({
				id: uuidv4(),
				category: "cost_anomaly",
				severity: overagePercent > 20 ? "critical" : "warning",
				title: `Monthly projection exceeds budget by ${overagePercent.toFixed(1)}%`,
				description: `Based on current usage, your monthly costs are projected at $${costData.monthlyProjection.toFixed(2)}, which is $${(costData.monthlyProjection - monthlyBudget).toFixed(2)} over your $${monthlyBudget.toFixed(2)} budget. Consider implementing cost optimizations immediately.`,
				detectedAt: new Date().toISOString(),
				estimatedMonthlyCost: costData.monthlyProjection,
				autoFixable: false,
				metadata: {
					monthlyBudget,
					monthlyProjection: costData.monthlyProjection,
					overage: costData.monthlyProjection - monthlyBudget,
					overagePercent,
				},
			});
		}

		// Check if currently over budget (for budgets with remaining amounts)
		if (costData.budgetLimit && costData.budgetRemaining !== undefined) {
			if (costData.budgetRemaining < 0) {
				redFlags.push({
					id: uuidv4(),
					category: "cost_anomaly",
					severity: "critical",
					title: "Budget limit exceeded",
					description: `You have exceeded your budget limit of $${costData.budgetLimit.toFixed(2)}. Current spending is $${(costData.budgetLimit - costData.budgetRemaining).toFixed(2)}. Immediate action required to reduce costs.`,
					detectedAt: new Date().toISOString(),
					estimatedMonthlyCost: costData.monthlyProjection,
					autoFixable: false,
					metadata: {
						budgetLimit: costData.budgetLimit,
						budgetRemaining: costData.budgetRemaining,
						overage: Math.abs(costData.budgetRemaining),
					},
				});
			} else if (costData.budgetRemaining < costData.budgetLimit * 0.1) {
				// Warn when <10% budget remaining
				redFlags.push({
					id: uuidv4(),
					category: "cost_anomaly",
					severity: "warning",
					title: `Only $${costData.budgetRemaining.toFixed(2)} remaining in budget`,
					description: `You have less than 10% of your budget remaining ($${costData.budgetRemaining.toFixed(2)} of $${costData.budgetLimit.toFixed(2)}). Consider implementing cost controls to avoid overspending.`,
					detectedAt: new Date().toISOString(),
					estimatedMonthlyCost: costData.monthlyProjection,
					autoFixable: false,
					metadata: {
						budgetLimit: costData.budgetLimit,
						budgetRemaining: costData.budgetRemaining,
						percentRemaining:
							(costData.budgetRemaining / costData.budgetLimit) * 100,
					},
				});
			}
		}

		return redFlags;
	}

	/**
	 * Detect sudden cost spikes (>2x standard deviation from historical average)
	 */
	private detectSuddenSpikes(
		currentData: CostSummary,
		historicalData: CostSummary[],
	): RedFlag[] {
		const redFlags: RedFlag[] = [];

		// Calculate historical average and standard deviation
		const historicalCosts = historicalData.map((d) => d.totalCurrentWeek);
		const average =
			historicalCosts.reduce((sum, cost) => sum + cost, 0) /
			historicalCosts.length;
		const variance =
			historicalCosts.reduce(
				(sum, cost) => sum + Math.pow(cost - average, 2),
				0,
			) / historicalCosts.length;
		const stdDev = Math.sqrt(variance);

		// Detect if current cost is >2 standard deviations above average
		const deviation = (currentData.totalCurrentWeek - average) / stdDev;

		if (deviation > 2) {
			redFlags.push({
				id: uuidv4(),
				category: "cost_anomaly",
				severity: deviation > 3 ? "critical" : "warning",
				title: "Unusual cost spike detected",
				description: `Current weekly costs ($${currentData.totalCurrentWeek.toFixed(2)}) are ${deviation.toFixed(1)} standard deviations above your historical average ($${average.toFixed(2)}). This is statistically unusual and warrants investigation.`,
				detectedAt: new Date().toISOString(),
				estimatedMonthlyCost: currentData.monthlyProjection,
				autoFixable: false,
				metadata: {
					currentCost: currentData.totalCurrentWeek,
					historicalAverage: average,
					standardDeviation: stdDev,
					deviations: deviation,
					sampleSize: historicalData.length,
				},
			});
		}

		return redFlags;
	}

	/**
	 * Detect unusual cost patterns (e.g., steadily increasing costs)
	 */
	private detectUnusualPatterns(
		currentData: CostSummary,
		historicalData: CostSummary[],
	): RedFlag[] {
		const redFlags: RedFlag[] = [];

		// Check for steadily increasing costs (4+ weeks in a row)
		const allData = [...historicalData, currentData].slice(-5); // Last 5 weeks including current
		const isIncreasing = allData.every((data, index) => {
			if (index === 0) return true;
			return data.totalCurrentWeek > allData[index - 1].totalCurrentWeek;
		});

		if (isIncreasing && allData.length >= 4) {
			const firstWeek = allData[0].totalCurrentWeek;
			const lastWeek = allData[allData.length - 1].totalCurrentWeek;
			const totalIncrease = ((lastWeek - firstWeek) / firstWeek) * 100;

			redFlags.push({
				id: uuidv4(),
				category: "cost_anomaly",
				severity: totalIncrease > 50 ? "warning" : "info",
				title: `Costs increasing steadily for ${allData.length} weeks`,
				description: `Your costs have increased every week for the past ${allData.length} weeks, from $${firstWeek.toFixed(2)} to $${lastWeek.toFixed(2)} (${totalIncrease.toFixed(1)}% total increase). This trend suggests growing resource usage or expanding infrastructure.`,
				detectedAt: new Date().toISOString(),
				estimatedMonthlyCost: currentData.monthlyProjection,
				autoFixable: false,
				metadata: {
					weeks: allData.length,
					firstWeekCost: firstWeek,
					lastWeekCost: lastWeek,
					totalIncreasePercent: totalIncrease,
					pattern: "steadily_increasing",
				},
			});
		}

		return redFlags;
	}

	/**
	 * Create detector output with metadata
	 */
	private createOutput(
		redFlags: RedFlag[],
		startTime: number,
		executionTime: number,
	): RedFlagDetectorOutput {
		return {
			redFlags,
			detectionMetadata: {
				detectorId: this.detectorId,
				detectorVersion: this.version,
				executionTimeMs: executionTime,
				resourcesScanned: redFlags.length,
			},
		};
	}

	/**
	 * Update detector configuration
	 */
	updateConfig(config: Partial<CostAnomalyDetectorConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get current configuration
	 */
	getConfig(): CostAnomalyDetectorConfig {
		return { ...this.config };
	}
}

// Export singleton instance
let detectorInstance: CostAnomalyDetector | null = null;

export function getCostAnomalyDetector(
	config?: Partial<CostAnomalyDetectorConfig>,
): CostAnomalyDetector {
	if (!detectorInstance) {
		detectorInstance = new CostAnomalyDetector(config);
	}
	return detectorInstance;
}

export function resetCostAnomalyDetector(): void {
	detectorInstance = null;
}
