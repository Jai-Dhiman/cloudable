import {
	CostExplorerClient,
	GetCostAndUsageCommand,
	GetCostAndUsageCommandInput,
	GetCostAndUsageCommandOutput,
} from "@aws-sdk/client-cost-explorer";
import type { CostSummary, CostBreakdown } from "../types/cost-monitor.js";

export interface CostExplorerConfig {
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

export class AWSCostExplorerClient {
	private client: CostExplorerClient;

	constructor(config: CostExplorerConfig = {}) {
		this.client = new CostExplorerClient({
			region: config.region || process.env.AWS_REGION || "us-east-1",
			credentials:
				config.accessKeyId && config.secretAccessKey
					? {
							accessKeyId: config.accessKeyId,
							secretAccessKey: config.secretAccessKey,
						}
					: undefined,
		});
	}

	async getLastWeekCosts(tags?: Record<string, string>): Promise<CostSummary> {
		const today = new Date();
		const lastWeekStart = new Date(today);
		lastWeekStart.setDate(today.getDate() - 7);
		const lastWeekEnd = today;

		const previousWeekStart = new Date(lastWeekStart);
		previousWeekStart.setDate(lastWeekStart.getDate() - 7);

		const [currentWeekData, previousWeekData] = await Promise.all([
			this.getCostData(lastWeekStart, lastWeekEnd, tags),
			this.getCostData(previousWeekStart, lastWeekStart, tags),
		]);

		const currentWeekTotal = this.sumCosts(currentWeekData);
		const previousWeekTotal = this.sumCosts(previousWeekData);

		const topServices = this.buildServiceBreakdown(
			currentWeekData,
			previousWeekData,
		);

		const totalChangeAmount = currentWeekTotal - previousWeekTotal;
		const totalChangePercent =
			previousWeekTotal > 0 ? (totalChangeAmount / previousWeekTotal) * 100 : 0;

		const monthlyProjection = currentWeekTotal * 4.33;

		return {
			totalCurrentWeek: currentWeekTotal,
			totalPreviousWeek: previousWeekTotal,
			totalChangePercent,
			totalChangeAmount,
			monthlyProjection,
			topServices,
			billingPeriodStart: this.formatDate(lastWeekStart),
			billingPeriodEnd: this.formatDate(lastWeekEnd),
		};
	}

	async getHistoricalCosts(
		weeks: number,
		tags?: Record<string, string>,
	): Promise<CostSummary[]> {
		const results: CostSummary[] = [];
		const today = new Date();

		for (let i = 0; i < weeks; i++) {
			const weekEnd = new Date(today);
			weekEnd.setDate(today.getDate() - i * 7);

			const weekStart = new Date(weekEnd);
			weekStart.setDate(weekEnd.getDate() - 7);

			const previousWeekStart = new Date(weekStart);
			previousWeekStart.setDate(weekStart.getDate() - 7);

			const [currentWeekData, previousWeekData] = await Promise.all([
				this.getCostData(weekStart, weekEnd, tags),
				this.getCostData(previousWeekStart, weekStart, tags),
			]);

			const currentWeekTotal = this.sumCosts(currentWeekData);
			const previousWeekTotal = this.sumCosts(previousWeekData);

			const topServices = this.buildServiceBreakdown(
				currentWeekData,
				previousWeekData,
			);

			const totalChangeAmount = currentWeekTotal - previousWeekTotal;
			const totalChangePercent =
				previousWeekTotal > 0
					? (totalChangeAmount / previousWeekTotal) * 100
					: 0;

			const monthlyProjection = currentWeekTotal * 4.33;

			results.push({
				totalCurrentWeek: currentWeekTotal,
				totalPreviousWeek: previousWeekTotal,
				totalChangePercent,
				totalChangeAmount,
				monthlyProjection,
				topServices,
				billingPeriodStart: this.formatDate(weekStart),
				billingPeriodEnd: this.formatDate(weekEnd),
			});
		}

		return results.reverse();
	}

	async getServiceBreakdown(
		startDate: Date,
		endDate: Date,
		tags?: Record<string, string>,
	): Promise<CostBreakdown[]> {
		const previousStart = new Date(startDate);
		previousStart.setDate(startDate.getDate() - 7);

		const [currentData, previousData] = await Promise.all([
			this.getCostData(startDate, endDate, tags),
			this.getCostData(previousStart, startDate, tags),
		]);

		return this.buildServiceBreakdown(currentData, previousData);
	}

	async getCostsByTags(tags: Record<string, string>): Promise<number> {
		const today = new Date();
		const lastWeekStart = new Date(today);
		lastWeekStart.setDate(today.getDate() - 7);

		const data = await this.getCostData(lastWeekStart, today, tags);
		return this.sumCosts(data);
	}

	private async getCostData(
		startDate: Date,
		endDate: Date,
		tags?: Record<string, string>,
	): Promise<GetCostAndUsageCommandOutput> {
		const input: GetCostAndUsageCommandInput = {
			TimePeriod: {
				Start: this.formatDate(startDate),
				End: this.formatDate(endDate),
			},
			Granularity: "DAILY",
			Metrics: ["UnblendedCost"],
			GroupBy: [
				{
					Type: "DIMENSION",
					Key: "SERVICE",
				},
			],
		};

		if (tags && Object.keys(tags).length > 0) {
			input.Filter = {
				And: Object.entries(tags).map(([key, value]) => ({
					Tags: {
						Key: key,
						Values: [value],
					},
				})),
			};
		}

		const command = new GetCostAndUsageCommand(input);
		return await this.client.send(command);
	}

	private sumCosts(data: GetCostAndUsageCommandOutput): number {
		if (!data.ResultsByTime) {
			return 0;
		}

		let total = 0;
		for (const result of data.ResultsByTime) {
			if (result.Groups) {
				for (const group of result.Groups) {
					if (group.Metrics?.UnblendedCost?.Amount) {
						total += parseFloat(group.Metrics.UnblendedCost.Amount);
					}
				}
			}
		}

		return Math.round(total * 100) / 100;
	}

	private buildServiceBreakdown(
		currentData: GetCostAndUsageCommandOutput,
		previousData: GetCostAndUsageCommandOutput,
	): CostBreakdown[] {
		const serviceMap = new Map<string, { current: number; previous: number }>();

		if (currentData.ResultsByTime) {
			for (const result of currentData.ResultsByTime) {
				if (result.Groups) {
					for (const group of result.Groups) {
						const service = group.Keys?.[0] || "Unknown";
						const cost = parseFloat(
							group.Metrics?.UnblendedCost?.Amount || "0",
						);

						const existing = serviceMap.get(service) || {
							current: 0,
							previous: 0,
						};
						existing.current += cost;
						serviceMap.set(service, existing);
					}
				}
			}
		}

		if (previousData.ResultsByTime) {
			for (const result of previousData.ResultsByTime) {
				if (result.Groups) {
					for (const group of result.Groups) {
						const service = group.Keys?.[0] || "Unknown";
						const cost = parseFloat(
							group.Metrics?.UnblendedCost?.Amount || "0",
						);

						const existing = serviceMap.get(service) || {
							current: 0,
							previous: 0,
						};
						existing.previous += cost;
						serviceMap.set(service, existing);
					}
				}
			}
		}

		const breakdowns: CostBreakdown[] = [];
		for (const [service, costs] of serviceMap.entries()) {
			const changeAmount = costs.current - costs.previous;
			const changePercent =
				costs.previous > 0 ? (changeAmount / costs.previous) * 100 : 0;
			const monthlyProjection = costs.current * 4.33;

			breakdowns.push({
				service,
				currentWeekCost: Math.round(costs.current * 100) / 100,
				previousWeekCost: Math.round(costs.previous * 100) / 100,
				changePercent: Math.round(changePercent * 100) / 100,
				changeAmount: Math.round(changeAmount * 100) / 100,
				monthlyProjection: Math.round(monthlyProjection * 100) / 100,
			});
		}

		return breakdowns.sort((a, b) => b.currentWeekCost - a.currentWeekCost);
	}

	private formatDate(date: Date): string {
		return date.toISOString().split("T")[0];
	}
}
