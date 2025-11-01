import { AWSCostExplorerClient } from "../integrations/aws-cost-explorer.js";
import { CostProjectionEngine } from "./cost-projection-engine.js";
import { RedFlagAggregator } from "./red-flag-aggregator.js";
import { HyperspellClient } from "../integrations/hyperspell.js";
import { DemoDataGenerator } from "./demo-data-generator.js";
import {
	EC2Client,
	DescribeInstancesCommand,
	DescribeNatGatewaysCommand,
} from "@aws-sdk/client-ec2";
import {
	RDSClient,
	DescribeDBInstancesCommand as DescribeRDSInstancesCommand,
} from "@aws-sdk/client-rds";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import type {
	CostSummary,
	RedFlag,
	LearningInsight,
	AWSResourceInventory,
	AWSResource,
} from "../types/cost-monitor.js";
import type { RedFlagSummary } from "./red-flag-aggregator.js";
import type {
	CostPrediction,
	MonthlyCostProjection,
} from "./cost-projection-engine.js";

export interface CostAnalysisResult {
	lastWeekCost: CostSummary;
	expectedNextWeekCost: CostPrediction;
	expectedMonthlyCost: MonthlyCostProjection;
	redFlags: RedFlag[];
	redFlagSummary: RedFlagSummary;
	learningInsights: LearningInsight[];
}

export interface CostAnalysisConfig {
	region?: string;
	awsAccessKeyId?: string;
	awsSecretAccessKey?: string;
	hyperspellApiKey?: string;
	demoMode?: boolean;
}

export class CostAnalysisService {
	private awsCostExplorer: AWSCostExplorerClient;
	private projectionEngine: CostProjectionEngine;
	private redFlagAggregator: RedFlagAggregator;
	private hyperspell: HyperspellClient;
	private ec2Client: EC2Client;
	private rdsClient: RDSClient;
	private s3Client: S3Client;
	private region: string;
	private demoMode: boolean;
	private demoDataGenerator: DemoDataGenerator;

	constructor(config: CostAnalysisConfig = {}) {
		this.region = config.region || process.env.AWS_REGION || "us-east-1";
		this.demoMode = config.demoMode || false;
		this.demoDataGenerator = new DemoDataGenerator();

		const hyperspellKey =
			config.hyperspellApiKey || (this.demoMode ? "demo-key" : undefined);

		this.awsCostExplorer = new AWSCostExplorerClient({
			region: this.region,
			accessKeyId: config.awsAccessKeyId,
			secretAccessKey: config.awsSecretAccessKey,
		});

		this.projectionEngine = new CostProjectionEngine(hyperspellKey);
		this.redFlagAggregator = new RedFlagAggregator(
			this.region,
			hyperspellKey,
			this.demoMode,
		);
		this.hyperspell = new HyperspellClient(hyperspellKey);

		this.ec2Client = new EC2Client({ region: this.region });
		this.rdsClient = new RDSClient({ region: this.region });
		this.s3Client = new S3Client({ region: this.region });
	}

	async generateCostAnalysis(
		deploymentId: string,
		tags?: Record<string, string>,
	): Promise<CostAnalysisResult> {
		let lastWeekCost: CostSummary;
		let historicalCosts: CostSummary[];
		let awsResources: AWSResourceInventory;

		if (this.demoMode) {
			lastWeekCost = this.demoDataGenerator.generateLastWeekCost();
			historicalCosts = this.demoDataGenerator.generateHistoricalCosts(4);
			awsResources =
				this.demoDataGenerator.generateDemoResourceInventory(deploymentId);
		} else {
			lastWeekCost = await this.awsCostExplorer.getLastWeekCosts(tags);
			historicalCosts = await this.awsCostExplorer.getHistoricalCosts(4, tags);
			awsResources = await this.getAWSResourceInventory(deploymentId, tags);
		}

		const expectedNextWeekCost =
			await this.projectionEngine.predictNextWeek(historicalCosts);

		const expectedMonthlyCost = await this.projectionEngine.projectMonthlyCost(
			lastWeekCost.totalCurrentWeek,
			historicalCosts,
		);

		const { redFlags, summary: redFlagSummary } =
			await this.redFlagAggregator.detectAllRedFlags({
				deploymentId,
				costData: lastWeekCost,
				awsResources,
				historicalData: historicalCosts,
			});

		const learningInsights = await this.generateLearningInsights(
			deploymentId,
			lastWeekCost,
		);

		if (!this.demoMode) {
			await this.storeActualCosts(deploymentId, lastWeekCost);
		}

		return {
			lastWeekCost,
			expectedNextWeekCost,
			expectedMonthlyCost,
			redFlags,
			redFlagSummary,
			learningInsights,
		};
	}

	private async getAWSResourceInventory(
		deploymentId: string,
		tags?: Record<string, string>,
	): Promise<AWSResourceInventory> {
		const resources: AWSResource[] = [];

		const [ec2Instances, rdsInstances, natGateways, s3Buckets] =
			await Promise.all([
				this.getEC2Resources(tags),
				this.getRDSResources(tags),
				this.getNATGatewayResources(tags),
				this.getS3Resources(tags),
			]);

		resources.push(
			...ec2Instances,
			...rdsInstances,
			...natGateways,
			...s3Buckets,
		);

		const totalMonthlyCost = resources.reduce(
			(sum, r) => sum + r.monthlyCost,
			0,
		);

		const resourcesByService: Record<string, AWSResource[]> = {};
		for (const resource of resources) {
			if (!resourcesByService[resource.service]) {
				resourcesByService[resource.service] = [];
			}
			resourcesByService[resource.service].push(resource);
		}

		return {
			deploymentId,
			lastUpdated: new Date().toISOString(),
			resources,
			totalResources: resources.length,
			totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
			resourcesByService,
		};
	}

	private async getEC2Resources(
		tags?: Record<string, string>,
	): Promise<AWSResource[]> {
		const resources: AWSResource[] = [];

		try {
			const command = new DescribeInstancesCommand({});
			const response = await this.ec2Client.send(command);

			if (response.Reservations) {
				for (const reservation of response.Reservations) {
					if (reservation.Instances) {
						for (const instance of reservation.Instances) {
							if (instance.State?.Name === "running") {
								const instanceTags: Record<string, string> = {};
								if (instance.Tags) {
									for (const tag of instance.Tags) {
										if (tag.Key && tag.Value) {
											instanceTags[tag.Key] = tag.Value;
										}
									}
								}

								resources.push({
									resourceId: instance.InstanceId || "unknown",
									resourceType: instance.InstanceType || "unknown",
									service: "EC2",
									region: this.region,
									tags: instanceTags,
									state: instance.State?.Name || "unknown",
									createdAt:
										instance.LaunchTime?.toISOString() ||
										new Date().toISOString(),
									monthlyCost: this.estimateEC2Cost(
										instance.InstanceType || "",
									),
									metadata: {
										availabilityZone: instance.Placement?.AvailabilityZone,
										publicIp: instance.PublicIpAddress,
									},
								});
							}
						}
					}
				}
			}
		} catch (error) {
			console.error("Error fetching EC2 resources:", error);
		}

		return resources;
	}

	private async getRDSResources(
		tags?: Record<string, string>,
	): Promise<AWSResource[]> {
		const resources: AWSResource[] = [];

		try {
			const command = new DescribeRDSInstancesCommand({});
			const response = await this.rdsClient.send(command);

			if (response.DBInstances) {
				for (const dbInstance of response.DBInstances) {
					const dbTags: Record<string, string> = {};

					resources.push({
						resourceId: dbInstance.DBInstanceIdentifier || "unknown",
						resourceType: dbInstance.DBInstanceClass || "unknown",
						service: "RDS",
						region: this.region,
						tags: dbTags,
						state: dbInstance.DBInstanceStatus || "unknown",
						createdAt:
							dbInstance.InstanceCreateTime?.toISOString() ||
							new Date().toISOString(),
						monthlyCost: this.estimateRDSCost(
							dbInstance.DBInstanceClass || "",
							dbInstance.AllocatedStorage || 0,
						),
						metadata: {
							engine: dbInstance.Engine,
							engineVersion: dbInstance.EngineVersion,
							multiAZ: dbInstance.MultiAZ,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error fetching RDS resources:", error);
		}

		return resources;
	}

	private async getNATGatewayResources(
		tags?: Record<string, string>,
	): Promise<AWSResource[]> {
		const resources: AWSResource[] = [];

		try {
			const command = new DescribeNatGatewaysCommand({});
			const response = await this.ec2Client.send(command);

			if (response.NatGateways) {
				for (const natGateway of response.NatGateways) {
					if (natGateway.State === "available") {
						const natTags: Record<string, string> = {};
						if (natGateway.Tags) {
							for (const tag of natGateway.Tags) {
								if (tag.Key && tag.Value) {
									natTags[tag.Key] = tag.Value;
								}
							}
						}

						resources.push({
							resourceId: natGateway.NatGatewayId || "unknown",
							resourceType: "NAT Gateway",
							service: "VPC",
							region: this.region,
							tags: natTags,
							state: natGateway.State || "unknown",
							createdAt:
								natGateway.CreateTime?.toISOString() ||
								new Date().toISOString(),
							monthlyCost: 32.85,
							metadata: {
								vpcId: natGateway.VpcId,
								subnetId: natGateway.SubnetId,
							},
						});
					}
				}
			}
		} catch (error) {
			console.error("Error fetching NAT Gateway resources:", error);
		}

		return resources;
	}

	private async getS3Resources(
		tags?: Record<string, string>,
	): Promise<AWSResource[]> {
		const resources: AWSResource[] = [];

		try {
			const command = new ListBucketsCommand({});
			const response = await this.s3Client.send(command);

			if (response.Buckets) {
				for (const bucket of response.Buckets) {
					resources.push({
						resourceId: bucket.Name || "unknown",
						resourceType: "Bucket",
						service: "S3",
						region: this.region,
						tags: {},
						state: "available",
						createdAt:
							bucket.CreationDate?.toISOString() || new Date().toISOString(),
						monthlyCost: 5,
						metadata: {},
					});
				}
			}
		} catch (error) {
			console.error("Error fetching S3 resources:", error);
		}

		return resources;
	}

	private async generateLearningInsights(
		deploymentId: string,
		costData: CostSummary,
	): Promise<LearningInsight[]> {
		const insights: LearningInsight[] = [];

		try {
			await this.hyperspell.initialize();

			for (const service of costData.topServices.slice(0, 3)) {
				const accuracy = await this.hyperspell.getCostEstimateAccuracy(
					service.service,
					service.service,
				);

				if (accuracy.sampleSize > 0) {
					insights.push({
						type: "prediction",
						message: `Historical cost predictions for ${service.service} have ${Math.abs(accuracy.avgVariancePercent).toFixed(1)}% average variance based on ${accuracy.sampleSize} samples`,
						confidence: Math.max(
							0,
							1 - Math.abs(accuracy.avgVariancePercent) / 100,
						),
						source: "cost_estimates",
						metadata: {
							sampleSize: accuracy.sampleSize,
							accuracy: accuracy.avgVariancePercent,
							lastUpdated: new Date().toISOString(),
						},
					});
				}
			}
		} catch (error) {
			console.error("Error generating learning insights:", error);
		}

		return insights;
	}

	private async storeActualCosts(
		deploymentId: string,
		costs: CostSummary,
	): Promise<void> {
		try {
			await this.hyperspell.initialize();

			for (const service of costs.topServices) {
				await this.hyperspell.storeCostEstimate({
					id: `${deploymentId}-${service.service}-${Date.now()}`,
					timestamp: new Date().toISOString(),
					deploymentId,
					service: service.service,
					resourceType: service.service,
					estimatedMonthlyCost: service.monthlyProjection,
					actualMonthlyCost: service.currentWeekCost * 4.33,
					estimationMethod: "aws_calculator",
					context: {
						region: this.region,
					},
				});
			}
		} catch (error) {
			console.error("Error storing actual costs to Hyperspell:", error);
		}
	}

	private estimateEC2Cost(instanceType: string): number {
		const pricingMap: Record<string, number> = {
			"t2.micro": 8.47,
			"t2.small": 16.79,
			"t2.medium": 33.58,
			"t3.micro": 7.59,
			"t3.small": 15.18,
			"t3.medium": 30.37,
			"t3.large": 60.74,
			"t3.xlarge": 121.47,
			"m5.large": 70.08,
			"m5.xlarge": 140.16,
			"m5.2xlarge": 280.32,
		};

		return pricingMap[instanceType] || 50;
	}

	private estimateRDSCost(instanceClass: string, storageGb: number): number {
		const instancePricing: Record<string, number> = {
			"db.t3.micro": 11.59,
			"db.t3.small": 23.18,
			"db.t3.medium": 46.36,
			"db.t3.large": 92.72,
			"db.m5.large": 122.85,
			"db.m5.xlarge": 245.7,
		};

		const instanceCost = instancePricing[instanceClass] || 50;
		const storageCost = storageGb * 0.115;

		return instanceCost + storageCost;
	}
}
