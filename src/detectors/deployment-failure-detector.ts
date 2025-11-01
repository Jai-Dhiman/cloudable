import { v4 as uuidv4 } from "uuid";
import {
	EC2Client,
	DescribeInstancesCommand,
	DescribeInstanceStatusCommand,
} from "@aws-sdk/client-ec2";
import {
	RDSClient,
	DescribeDBInstancesCommand as DescribeRDSInstancesCommand,
} from "@aws-sdk/client-rds";
import {
	CloudFormationClient,
	DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import {
	CloudWatchLogsClient,
	FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { HyperspellClient } from "../integrations/hyperspell.js";
import type {
	RedFlag,
	RedFlagDetectorInput,
	RedFlagDetectorOutput,
	DetectorConfig,
} from "../types/cost-monitor.js";

export class DeploymentFailureDetector {
	private ec2Client: EC2Client;
	private rdsClient: RDSClient;
	private cfnClient: CloudFormationClient;
	private logsClient: CloudWatchLogsClient;
	private hyperspell: HyperspellClient;
	private config: DetectorConfig;

	constructor(
		config?: Partial<DetectorConfig>,
		region: string = "us-east-1",
		hyperspellApiKey?: string,
	) {
		this.ec2Client = new EC2Client({ region });
		this.rdsClient = new RDSClient({ region });
		this.cfnClient = new CloudFormationClient({ region });
		this.logsClient = new CloudWatchLogsClient({ region });
		this.hyperspell = new HyperspellClient(hyperspellApiKey);

		this.config = {
			enabled: true,
			severity: "critical",
			thresholds: {},
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
					detectorId: "deployment-failure-detector",
					detectorVersion: "1.0.0",
					executionTimeMs: Date.now() - startTime,
					resourcesScanned: 0,
				},
			};
		}

		let resourcesScanned = 0;

		const [ec2Flags, rdsFlags, cfnFlags] = await Promise.all([
			this.detectFailedEC2Instances(input),
			this.detectFailedRDSInstances(input),
			this.detectFailedCloudFormationStacks(input),
		]);

		redFlags.push(...ec2Flags, ...rdsFlags, ...cfnFlags);

		resourcesScanned = input.awsResources.totalResources;

		return {
			redFlags,
			detectionMetadata: {
				detectorId: "deployment-failure-detector",
				detectorVersion: "1.0.0",
				executionTimeMs: Date.now() - startTime,
				resourcesScanned,
			},
		};
	}

	private async detectFailedEC2Instances(
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
					const instanceId = instance.InstanceId;
					const state = instance.State?.Name;

					if (!instanceId || !state) {
						continue;
					}

					if (state === "terminated" && instance.StateTransitionReason) {
						const reason = instance.StateTransitionReason;

						if (reason.includes("Server.InsufficientInstanceCapacity")) {
							const knownFix = await this.getKnownFix(
								"InsufficientInstanceCapacity",
							);

							redFlags.push({
								id: uuidv4(),
								category: "deployment_failure",
								severity: "critical",
								title: `EC2 instance ${instanceId} failed to launch`,
								description: `Instance launch failed due to InsufficientInstanceCapacity in ${instance.Placement?.AvailabilityZone}. ${knownFix}`,
								detectedAt: new Date().toISOString(),
								resourceId: instanceId,
								resourceType: "EC2",
								autoFixable: false,
								metadata: {
									errorCode: "InsufficientInstanceCapacity",
									availabilityZone: instance.Placement?.AvailabilityZone,
									instanceType: instance.InstanceType,
									suggestedFix:
										"Try launching in a different availability zone",
								},
							});
						}
					}

					if (state === "running") {
						const statusCommand = new DescribeInstanceStatusCommand({
							InstanceIds: [instanceId],
						});
						const statusResponse = await this.ec2Client.send(statusCommand);

						if (
							statusResponse.InstanceStatuses &&
							statusResponse.InstanceStatuses.length > 0
						) {
							const status = statusResponse.InstanceStatuses[0];

							if (
								status.InstanceStatus?.Status === "impaired" ||
								status.SystemStatus?.Status === "impaired"
							) {
								redFlags.push({
									id: uuidv4(),
									category: "deployment_failure",
									severity: "critical",
									title: `EC2 instance ${instanceId} has impaired status`,
									description: `Instance ${instanceId} is running but has impaired system or instance status checks.`,
									detectedAt: new Date().toISOString(),
									resourceId: instanceId,
									resourceType: "EC2",
									autoFixable: false,
									metadata: {
										instanceStatus: status.InstanceStatus?.Status,
										systemStatus: status.SystemStatus?.Status,
									},
								});
							}
						}
					}
				}
			}
		} catch (error) {
			console.error("Error detecting failed EC2 instances:", error);
		}

		return redFlags;
	}

	private async detectFailedRDSInstances(
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
				const status = dbInstance.DBInstanceStatus;

				if (!dbInstanceId || !status) {
					continue;
				}

				if (
					status === "failed" ||
					status === "incompatible-parameters" ||
					status === "incompatible-restore" ||
					status === "inaccessible-encryption-credentials"
				) {
					redFlags.push({
						id: uuidv4(),
						category: "deployment_failure",
						severity: "critical",
						title: `RDS instance ${dbInstanceId} creation failed`,
						description: `RDS instance ${dbInstanceId} is in ${status} status. Check configuration and credentials.`,
						detectedAt: new Date().toISOString(),
						resourceId: dbInstanceId,
						resourceType: "RDS",
						autoFixable: false,
						metadata: {
							status,
							engine: dbInstance.Engine,
							engineVersion: dbInstance.EngineVersion,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting failed RDS instances:", error);
		}

		return redFlags;
	}

	private async detectFailedCloudFormationStacks(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const command = new DescribeStacksCommand({});
			const response = await this.cfnClient.send(command);

			if (!response.Stacks) {
				return redFlags;
			}

			for (const stack of response.Stacks) {
				const stackName = stack.StackName;
				const status = stack.StackStatus;

				if (!stackName || !status) {
					continue;
				}

				if (
					status === "ROLLBACK_COMPLETE" ||
					status === "ROLLBACK_FAILED" ||
					status === "CREATE_FAILED" ||
					status === "DELETE_FAILED" ||
					status === "UPDATE_ROLLBACK_COMPLETE" ||
					status === "UPDATE_ROLLBACK_FAILED"
				) {
					const statusReason = stack.StackStatusReason || "No reason provided";

					redFlags.push({
						id: uuidv4(),
						category: "deployment_failure",
						severity: "critical",
						title: `CloudFormation stack ${stackName} failed`,
						description: `Stack ${stackName} is in ${status} status. Reason: ${statusReason}`,
						detectedAt: new Date().toISOString(),
						resourceId: stack.StackId || stackName,
						resourceType: "CloudFormation Stack",
						autoFixable: false,
						metadata: {
							status,
							statusReason,
							creationTime: stack.CreationTime?.toISOString(),
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting failed CloudFormation stacks:", error);
		}

		return redFlags;
	}

	private async getKnownFix(errorCode: string): Promise<string> {
		try {
			await this.hyperspell.initialize();
			const resolution = await this.hyperspell.queryErrorResolution(errorCode);

			if (resolution) {
				return `Known fix (${resolution.successRate * 100}% success rate): ${resolution.resolutionSteps.join(", ")}`;
			}
		} catch (error) {
			console.error("Error querying Hyperspell for known fix:", error);
		}

		return "This is a common temporary AWS issue.";
	}
}
