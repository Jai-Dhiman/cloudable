import { v4 as uuidv4 } from "uuid";
import {
	EC2Client,
	DescribeInstancesCommand,
	DescribeAddressesCommand,
	DescribeSnapshotsCommand,
	DescribeNatGatewaysCommand,
} from "@aws-sdk/client-ec2";
import {
	RDSClient,
	DescribeDBInstancesCommand as DescribeRDSInstancesCommand,
} from "@aws-sdk/client-rds";
import { AWSCloudWatchClient } from "../integrations/aws-cloudwatch.js";
import type {
	RedFlag,
	RedFlagDetectorInput,
	RedFlagDetectorOutput,
	ResourceWasteDetectorConfig,
} from "../types/cost-monitor.js";

export class ResourceWasteDetector {
	private ec2Client: EC2Client;
	private rdsClient: RDSClient;
	private cloudwatch: AWSCloudWatchClient;
	private config: ResourceWasteDetectorConfig;

	constructor(
		config?: Partial<ResourceWasteDetectorConfig>,
		region: string = "us-east-1",
	) {
		this.ec2Client = new EC2Client({ region });
		this.rdsClient = new RDSClient({ region });
		this.cloudwatch = new AWSCloudWatchClient({ region });

		this.config = {
			enabled: true,
			severity: "warning",
			thresholds: {
				maxCpuUtilizationPercent: 5,
				minNetworkTrafficMbPerDay: 10,
				minDiskIoOpsPerDay: 100,
			},
			scanPeriodDays: 7,
			...config,
		};
	}

	async detect(input: RedFlagDetectorInput): Promise<RedFlagDetectorOutput> {
		const startTime = Date.now();
		const redFlags: RedFlag[] = [];

		if (!this.config.enabled) {
			return {
				redFlags: [],
				detectionMetadata: {
					detectorId: "resource-waste-detector",
					detectorVersion: "1.0.0",
					executionTimeMs: Date.now() - startTime,
					resourcesScanned: 0,
				},
			};
		}

		let resourcesScanned = 0;

		const [
			idleEC2Flags,
			unusedEIPFlags,
			oldSnapshotFlags,
			unusedNATFlags,
			oversizedRDSFlags,
		] = await Promise.all([
			this.detectIdleEC2Instances(input),
			this.detectUnusedElasticIPs(input),
			this.detectOldSnapshots(input),
			this.detectUnusedNATGateways(input),
			this.detectOversizedRDS(input),
		]);

		redFlags.push(
			...idleEC2Flags,
			...unusedEIPFlags,
			...oldSnapshotFlags,
			...unusedNATFlags,
			...oversizedRDSFlags,
		);

		resourcesScanned = input.awsResources.totalResources;

		return {
			redFlags,
			detectionMetadata: {
				detectorId: "resource-waste-detector",
				detectorVersion: "1.0.0",
				executionTimeMs: Date.now() - startTime,
				resourcesScanned,
			},
		};
	}

	private async detectIdleEC2Instances(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const command = new DescribeInstancesCommand({});
			const response = await this.ec2Client.send(command);

			if (!response.Reservations) {
				return redFlags;
			}

			for (const reservation of response.Reservations) {
				if (!reservation.Instances) {
					continue;
				}

				for (const instance of reservation.Instances) {
					if (instance.State?.Name !== "running") {
						continue;
					}

					const instanceId = instance.InstanceId;
					if (!instanceId) {
						continue;
					}

					const cpuMetrics = await this.cloudwatch.getEC2CPUUtilization(
						instanceId,
						this.config.scanPeriodDays,
					);

					const avgCpu = cpuMetrics.average || 0;

					if (avgCpu < this.config.thresholds.maxCpuUtilizationPercent) {
						const instanceType = instance.InstanceType || "unknown";
						const estimatedMonthlyCost =
							this.estimateEC2MonthlyCost(instanceType);

						redFlags.push({
							id: uuidv4(),
							category: "resource_waste",
							severity: avgCpu < 1 ? "critical" : "warning",
							title: `EC2 instance ${instanceId} is idle`,
							description: `CPU utilization averaged ${avgCpu.toFixed(1)}% over the last ${this.config.scanPeriodDays} days. Consider stopping or downsizing this instance.`,
							detectedAt: new Date().toISOString(),
							resourceId: instanceId,
							resourceType: "EC2",
							estimatedMonthlyCost,
							estimatedSavings: estimatedMonthlyCost,
							autoFixable: true,
							fixCommand: "Stop instance",
							metadata: {
								avgCpu,
								period: `${this.config.scanPeriodDays} days`,
								instanceType,
							},
						});
					}
				}
			}
		} catch (error) {
			console.error("Error detecting idle EC2 instances:", error);
		}

		return redFlags;
	}

	private async detectUnusedElasticIPs(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const command = new DescribeAddressesCommand({});
			const response = await this.ec2Client.send(command);

			if (!response.Addresses) {
				return redFlags;
			}

			for (const address of response.Addresses) {
				if (!address.AssociationId) {
					const eipCost = 3.65;

					redFlags.push({
						id: uuidv4(),
						category: "resource_waste",
						severity: "warning",
						title: `Unused Elastic IP ${address.PublicIp}`,
						description: `Elastic IP ${address.PublicIp} is not associated with any running instance. Unattached EIPs incur charges.`,
						detectedAt: new Date().toISOString(),
						resourceId: address.AllocationId || address.PublicIp || "unknown",
						resourceType: "Elastic IP",
						estimatedMonthlyCost: eipCost,
						estimatedSavings: eipCost,
						autoFixable: true,
						fixCommand: "Release Elastic IP",
						metadata: {
							publicIp: address.PublicIp,
							allocationId: address.AllocationId,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting unused Elastic IPs:", error);
		}

		return redFlags;
	}

	private async detectOldSnapshots(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const command = new DescribeSnapshotsCommand({
				OwnerIds: ["self"],
			});
			const response = await this.ec2Client.send(command);

			if (!response.Snapshots) {
				return redFlags;
			}

			const ninetyDaysAgo = new Date();
			ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

			for (const snapshot of response.Snapshots) {
				const startTime = snapshot.StartTime;
				if (!startTime) {
					continue;
				}

				if (startTime < ninetyDaysAgo) {
					const sizeGb = snapshot.VolumeSize || 0;
					const estimatedMonthlyCost = sizeGb * 0.05;

					redFlags.push({
						id: uuidv4(),
						category: "resource_waste",
						severity: "info",
						title: `Old snapshot ${snapshot.SnapshotId}`,
						description: `Snapshot ${snapshot.SnapshotId} is over 90 days old. Consider deleting if no longer needed.`,
						detectedAt: new Date().toISOString(),
						resourceId: snapshot.SnapshotId || "unknown",
						resourceType: "EBS Snapshot",
						estimatedMonthlyCost,
						estimatedSavings: estimatedMonthlyCost,
						autoFixable: false,
						metadata: {
							createdAt: startTime.toISOString(),
							sizeGb,
							description: snapshot.Description,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting old snapshots:", error);
		}

		return redFlags;
	}

	private async detectUnusedNATGateways(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const command = new DescribeNatGatewaysCommand({});
			const response = await this.ec2Client.send(command);

			if (!response.NatGateways) {
				return redFlags;
			}

			for (const natGateway of response.NatGateways) {
				if (natGateway.State !== "available") {
					continue;
				}

				const natGatewayId = natGateway.NatGatewayId;
				if (!natGatewayId) {
					continue;
				}

				const bytesMetrics = await this.cloudwatch.getNATGatewayBytesOut(
					natGatewayId,
					this.config.scanPeriodDays,
				);

				const totalBytes = bytesMetrics.sum || 0;
				const totalMb = totalBytes / (1024 * 1024);
				const avgMbPerDay = totalMb / this.config.scanPeriodDays;

				if (avgMbPerDay < this.config.thresholds.minNetworkTrafficMbPerDay) {
					const natCost = 32.85;

					redFlags.push({
						id: uuidv4(),
						category: "resource_waste",
						severity: "warning",
						title: `Unused NAT Gateway ${natGatewayId}`,
						description: `NAT Gateway ${natGatewayId} averaged ${avgMbPerDay.toFixed(1)} MB/day over the last ${this.config.scanPeriodDays} days. Consider removing if not needed.`,
						detectedAt: new Date().toISOString(),
						resourceId: natGatewayId,
						resourceType: "NAT Gateway",
						estimatedMonthlyCost: natCost,
						estimatedSavings: natCost,
						autoFixable: true,
						fixCommand: "Delete NAT Gateway",
						metadata: {
							avgMbPerDay,
							period: `${this.config.scanPeriodDays} days`,
							totalMb,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting unused NAT Gateways:", error);
		}

		return redFlags;
	}

	private async detectOversizedRDS(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const command = new DescribeRDSInstancesCommand({});
			const response = await this.rdsClient.send(command);

			if (!response.DBInstances) {
				return redFlags;
			}

			for (const dbInstance of response.DBInstances) {
				const dbInstanceId = dbInstance.DBInstanceIdentifier;
				if (!dbInstanceId) {
					continue;
				}

				const storageMetrics = await this.cloudwatch.getRDSFreeStorageSpace(
					dbInstanceId,
					this.config.scanPeriodDays,
				);

				const avgFreeSpace = storageMetrics.average || 0;
				const allocatedStorage = dbInstance.AllocatedStorage || 0;
				const avgFreeSpaceGb = avgFreeSpace / (1024 * 1024 * 1024);

				const utilizationPercent =
					allocatedStorage > 0
						? ((allocatedStorage - avgFreeSpaceGb) / allocatedStorage) * 100
						: 0;

				if (utilizationPercent < 20) {
					const instanceClass = dbInstance.DBInstanceClass || "unknown";
					const estimatedMonthlyCost = this.estimateRDSMonthlyCost(
						instanceClass,
						allocatedStorage,
					);

					const potentialReduction = allocatedStorage * 0.5;
					const estimatedSavings = potentialReduction * 0.115;

					redFlags.push({
						id: uuidv4(),
						category: "resource_waste",
						severity: "info",
						title: `RDS instance ${dbInstanceId} is oversized`,
						description: `RDS instance ${dbInstanceId} is using only ${utilizationPercent.toFixed(1)}% of allocated storage. Consider reducing storage allocation.`,
						detectedAt: new Date().toISOString(),
						resourceId: dbInstanceId,
						resourceType: "RDS",
						estimatedMonthlyCost,
						estimatedSavings,
						autoFixable: false,
						metadata: {
							utilizationPercent,
							allocatedStorageGb: allocatedStorage,
							avgFreeSpaceGb,
							instanceClass,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting oversized RDS:", error);
		}

		return redFlags;
	}

	private estimateEC2MonthlyCost(instanceType: string): number {
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

	private estimateRDSMonthlyCost(
		instanceClass: string,
		storageGb: number,
	): number {
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
