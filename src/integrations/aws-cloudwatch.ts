import {
	CloudWatchClient,
	GetMetricStatisticsCommand,
	GetMetricStatisticsCommandInput,
	Statistic,
} from "@aws-sdk/client-cloudwatch";

export interface CloudWatchConfig {
	region?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
}

export interface MetricQuery {
	namespace: string;
	metricName: string;
	dimensions: Array<{ name: string; value: string }>;
	statistics: string[];
	period?: number;
	startTime?: Date;
	endTime?: Date;
}

export interface MetricDataPoint {
	timestamp: Date;
	value: number;
	unit: string;
}

export interface MetricResult {
	metricName: string;
	dataPoints: MetricDataPoint[];
	average?: number;
	maximum?: number;
	minimum?: number;
	sum?: number;
}

export class AWSCloudWatchClient {
	private client: CloudWatchClient;

	constructor(config: CloudWatchConfig = {}) {
		this.client = new CloudWatchClient({
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

	async getEC2CPUUtilization(
		instanceId: string,
		days: number = 7,
	): Promise<MetricResult> {
		const endTime = new Date();
		const startTime = new Date();
		startTime.setDate(startTime.getDate() - days);

		return await this.getMetric({
			namespace: "AWS/EC2",
			metricName: "CPUUtilization",
			dimensions: [{ name: "InstanceId", value: instanceId }],
			statistics: ["Average", "Maximum", "Minimum"],
			period: 3600,
			startTime,
			endTime,
		});
	}

	async getEC2NetworkIn(
		instanceId: string,
		days: number = 7,
	): Promise<MetricResult> {
		const endTime = new Date();
		const startTime = new Date();
		startTime.setDate(startTime.getDate() - days);

		return await this.getMetric({
			namespace: "AWS/EC2",
			metricName: "NetworkIn",
			dimensions: [{ name: "InstanceId", value: instanceId }],
			statistics: ["Sum", "Average"],
			period: 3600,
			startTime,
			endTime,
		});
	}

	async getEC2DiskReadOps(
		instanceId: string,
		days: number = 7,
	): Promise<MetricResult> {
		const endTime = new Date();
		const startTime = new Date();
		startTime.setDate(startTime.getDate() - days);

		return await this.getMetric({
			namespace: "AWS/EC2",
			metricName: "DiskReadOps",
			dimensions: [{ name: "InstanceId", value: instanceId }],
			statistics: ["Sum"],
			period: 3600,
			startTime,
			endTime,
		});
	}

	async getNATGatewayBytesOut(
		natGatewayId: string,
		days: number = 7,
	): Promise<MetricResult> {
		const endTime = new Date();
		const startTime = new Date();
		startTime.setDate(startTime.getDate() - days);

		return await this.getMetric({
			namespace: "AWS/NATGateway",
			metricName: "BytesOutToDestination",
			dimensions: [{ name: "NatGatewayId", value: natGatewayId }],
			statistics: ["Sum"],
			period: 3600,
			startTime,
			endTime,
		});
	}

	async getRDSFreeStorageSpace(
		dbInstanceId: string,
		days: number = 7,
	): Promise<MetricResult> {
		const endTime = new Date();
		const startTime = new Date();
		startTime.setDate(startTime.getDate() - days);

		return await this.getMetric({
			namespace: "AWS/RDS",
			metricName: "FreeStorageSpace",
			dimensions: [{ name: "DBInstanceIdentifier", value: dbInstanceId }],
			statistics: ["Average"],
			period: 3600,
			startTime,
			endTime,
		});
	}

	async getRDSCPUUtilization(
		dbInstanceId: string,
		days: number = 7,
	): Promise<MetricResult> {
		const endTime = new Date();
		const startTime = new Date();
		startTime.setDate(startTime.getDate() - days);

		return await this.getMetric({
			namespace: "AWS/RDS",
			metricName: "CPUUtilization",
			dimensions: [{ name: "DBInstanceIdentifier", value: dbInstanceId }],
			statistics: ["Average", "Maximum"],
			period: 3600,
			startTime,
			endTime,
		});
	}

	async getELBRequestCount(
		loadBalancerName: string,
		days: number = 7,
	): Promise<MetricResult> {
		const endTime = new Date();
		const startTime = new Date();
		startTime.setDate(startTime.getDate() - days);

		return await this.getMetric({
			namespace: "AWS/ELB",
			metricName: "RequestCount",
			dimensions: [{ name: "LoadBalancerName", value: loadBalancerName }],
			statistics: ["Sum"],
			period: 3600,
			startTime,
			endTime,
		});
	}

	async getMetric(query: MetricQuery): Promise<MetricResult> {
		const endTime = query.endTime || new Date();
		const startTime =
			query.startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		const input: GetMetricStatisticsCommandInput = {
			Namespace: query.namespace,
			MetricName: query.metricName,
			Dimensions: query.dimensions.map((d) => ({
				Name: d.name,
				Value: d.value,
			})),
			Statistics: query.statistics as Statistic[],
			Period: query.period || 3600,
			StartTime: startTime,
			EndTime: endTime,
		};

		const command = new GetMetricStatisticsCommand(input);
		const response = await this.client.send(command);

		const dataPoints: MetricDataPoint[] = (response.Datapoints || [])
			.map((dp) => ({
				timestamp: dp.Timestamp || new Date(),
				value: dp.Average || dp.Sum || dp.Maximum || dp.Minimum || 0,
				unit: dp.Unit || "",
			}))
			.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		let average: number | undefined;
		let maximum: number | undefined;
		let minimum: number | undefined;
		let sum: number | undefined;

		if (response.Datapoints && response.Datapoints.length > 0) {
			const averages = response.Datapoints.map((dp) => dp.Average).filter(
				(v): v is number => v !== undefined,
			);
			if (averages.length > 0) {
				average = averages.reduce((a, b) => a + b, 0) / averages.length;
			}

			const maximums = response.Datapoints.map((dp) => dp.Maximum).filter(
				(v): v is number => v !== undefined,
			);
			if (maximums.length > 0) {
				maximum = Math.max(...maximums);
			}

			const minimums = response.Datapoints.map((dp) => dp.Minimum).filter(
				(v): v is number => v !== undefined,
			);
			if (minimums.length > 0) {
				minimum = Math.min(...minimums);
			}

			const sums = response.Datapoints.map((dp) => dp.Sum).filter(
				(v): v is number => v !== undefined,
			);
			if (sums.length > 0) {
				sum = sums.reduce((a, b) => a + b, 0);
			}
		}

		return {
			metricName: query.metricName,
			dataPoints,
			average,
			maximum,
			minimum,
			sum,
		};
	}

	async getMetricAverage(query: MetricQuery): Promise<number> {
		const result = await this.getMetric(query);
		return result.average || 0;
	}

	async getMetricSum(query: MetricQuery): Promise<number> {
		const result = await this.getMetric(query);
		return result.sum || 0;
	}
}
