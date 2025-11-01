import { v4 as uuidv4 } from "uuid";
import {
	EC2Client,
	DescribeSecurityGroupsCommand,
	DescribeVolumesCommand,
} from "@aws-sdk/client-ec2";
import {
	RDSClient,
	DescribeDBInstancesCommand as DescribeRDSInstancesCommand,
} from "@aws-sdk/client-rds";
import {
	S3Client,
	ListBucketsCommand,
	GetBucketEncryptionCommand,
	GetBucketAclCommand,
	GetPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";
import type {
	RedFlag,
	RedFlagDetectorInput,
	RedFlagDetectorOutput,
	SecurityRiskDetectorConfig,
} from "../types/cost-monitor.js";

export class SecurityRiskDetector {
	private ec2Client: EC2Client;
	private rdsClient: RDSClient;
	private s3Client: S3Client;
	private config: SecurityRiskDetectorConfig;

	constructor(
		config?: Partial<SecurityRiskDetectorConfig>,
		region: string = "us-east-1",
	) {
		this.ec2Client = new EC2Client({ region });
		this.rdsClient = new RDSClient({ region });
		this.s3Client = new S3Client({ region });

		this.config = {
			enabled: true,
			severity: "critical",
			thresholds: {
				maxOpenPortsPublic: 0,
			},
			checkEncryption: true,
			checkPublicAccess: true,
			checkSecurityGroups: true,
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
					detectorId: "security-risk-detector",
					detectorVersion: "1.0.0",
					executionTimeMs: Date.now() - startTime,
					resourcesScanned: 0,
				},
			};
		}

		let resourcesScanned = 0;

		const [
			securityGroupFlags,
			publicRDSFlags,
			unencryptedEBSFlags,
			s3SecurityFlags,
		] = await Promise.all([
			this.config.checkSecurityGroups
				? this.detectOpenSecurityGroups(input)
				: Promise.resolve([]),
			this.config.checkPublicAccess
				? this.detectPublicRDSInstances(input)
				: Promise.resolve([]),
			this.config.checkEncryption
				? this.detectUnencryptedEBSVolumes(input)
				: Promise.resolve([]),
			this.config.checkEncryption && this.config.checkPublicAccess
				? this.detectS3SecurityIssues(input)
				: Promise.resolve([]),
		]);

		redFlags.push(
			...securityGroupFlags,
			...publicRDSFlags,
			...unencryptedEBSFlags,
			...s3SecurityFlags,
		);

		resourcesScanned = input.awsResources.totalResources;

		return {
			redFlags,
			detectionMetadata: {
				detectorId: "security-risk-detector",
				detectorVersion: "1.0.0",
				executionTimeMs: Date.now() - startTime,
				resourcesScanned,
			},
		};
	}

	private async detectOpenSecurityGroups(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];
		const dangerousPorts = [22, 3389, 3306, 5432, 27017, 6379];

		try {
			const command = new DescribeSecurityGroupsCommand({});
			const response = await this.ec2Client.send(command);

			if (!response.SecurityGroups) {
				return redFlags;
			}

			for (const sg of response.SecurityGroups) {
				if (!sg.IpPermissions) {
					continue;
				}

				for (const permission of sg.IpPermissions) {
					if (!permission.IpRanges) {
						continue;
					}

					for (const ipRange of permission.IpRanges) {
						if (ipRange.CidrIp === "0.0.0.0/0") {
							const port = permission.FromPort || 0;

							if (dangerousPorts.includes(port)) {
								const portNames: Record<number, string> = {
									22: "SSH",
									3389: "RDP",
									3306: "MySQL",
									5432: "PostgreSQL",
									27017: "MongoDB",
									6379: "Redis",
								};

								const portName = portNames[port] || `port ${port}`;

								redFlags.push({
									id: uuidv4(),
									category: "security_risk",
									severity: "critical",
									title: `Security group ${sg.GroupId} allows ${portName} from anywhere`,
									description: `Security group "${sg.GroupName}" allows inbound ${portName} (port ${port}) from 0.0.0.0/0. This exposes your instances to potential attacks.`,
									detectedAt: new Date().toISOString(),
									resourceId: sg.GroupId || "unknown",
									resourceType: "Security Group",
									autoFixable: true,
									fixCommand: "Restrict to specific IPs",
									metadata: {
										port,
										protocol: permission.IpProtocol,
										cidr: "0.0.0.0/0",
										groupName: sg.GroupName,
										vpcId: sg.VpcId,
									},
								});
							}
						}
					}
				}
			}
		} catch (error) {
			console.error("Error detecting open security groups:", error);
		}

		return redFlags;
	}

	private async detectPublicRDSInstances(
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
				if (dbInstance.PubliclyAccessible) {
					const dbInstanceId = dbInstance.DBInstanceIdentifier || "unknown";

					redFlags.push({
						id: uuidv4(),
						category: "security_risk",
						severity: "critical",
						title: `RDS instance ${dbInstanceId} is publicly accessible`,
						description: `RDS instance ${dbInstanceId} has public accessibility enabled. This allows internet access to your database.`,
						detectedAt: new Date().toISOString(),
						resourceId: dbInstanceId,
						resourceType: "RDS",
						autoFixable: true,
						fixCommand: "Disable public accessibility",
						metadata: {
							engine: dbInstance.Engine,
							engineVersion: dbInstance.EngineVersion,
							multiAZ: dbInstance.MultiAZ,
							endpoint: dbInstance.Endpoint?.Address,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting public RDS instances:", error);
		}

		return redFlags;
	}

	private async detectUnencryptedEBSVolumes(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const command = new DescribeVolumesCommand({});
			const response = await this.ec2Client.send(command);

			if (!response.Volumes) {
				return redFlags;
			}

			for (const volume of response.Volumes) {
				if (!volume.Encrypted) {
					const volumeId = volume.VolumeId || "unknown";
					const sizeGb = volume.Size || 0;

					redFlags.push({
						id: uuidv4(),
						category: "security_risk",
						severity: "warning",
						title: `EBS volume ${volumeId} is not encrypted`,
						description: `EBS volume ${volumeId} (${sizeGb} GB) is not encrypted. Encryption at rest is recommended for data security.`,
						detectedAt: new Date().toISOString(),
						resourceId: volumeId,
						resourceType: "EBS Volume",
						autoFixable: false,
						metadata: {
							sizeGb,
							volumeType: volume.VolumeType,
							state: volume.State,
							availabilityZone: volume.AvailabilityZone,
						},
					});
				}
			}
		} catch (error) {
			console.error("Error detecting unencrypted EBS volumes:", error);
		}

		return redFlags;
	}

	private async detectS3SecurityIssues(
		input: RedFlagDetectorInput,
	): Promise<RedFlag[]> {
		const redFlags: RedFlag[] = [];

		try {
			const listCommand = new ListBucketsCommand({});
			const listResponse = await this.s3Client.send(listCommand);

			if (!listResponse.Buckets) {
				return redFlags;
			}

			for (const bucket of listResponse.Buckets) {
				const bucketName = bucket.Name;
				if (!bucketName) {
					continue;
				}

				try {
					const encryptionCommand = new GetBucketEncryptionCommand({
						Bucket: bucketName,
					});
					await this.s3Client.send(encryptionCommand);
				} catch (error) {
					if (
						(error as Error).name ===
						"ServerSideEncryptionConfigurationNotFoundError"
					) {
						redFlags.push({
							id: uuidv4(),
							category: "security_risk",
							severity: "warning",
							title: `S3 bucket ${bucketName} is not encrypted`,
							description: `S3 bucket ${bucketName} does not have default encryption enabled. Enable encryption for data at rest.`,
							detectedAt: new Date().toISOString(),
							resourceId: bucketName,
							resourceType: "S3 Bucket",
							autoFixable: true,
							fixCommand: "Enable default encryption",
							metadata: {
								bucketName,
								createdAt: bucket.CreationDate?.toISOString(),
							},
						});
					}
				}

				try {
					const publicAccessCommand = new GetPublicAccessBlockCommand({
						Bucket: bucketName,
					});
					const publicAccessResponse =
						await this.s3Client.send(publicAccessCommand);

					const config = publicAccessResponse.PublicAccessBlockConfiguration;
					if (
						!config?.BlockPublicAcls ||
						!config?.BlockPublicPolicy ||
						!config?.IgnorePublicAcls ||
						!config?.RestrictPublicBuckets
					) {
						redFlags.push({
							id: uuidv4(),
							category: "security_risk",
							severity: "critical",
							title: `S3 bucket ${bucketName} has public access`,
							description: `S3 bucket ${bucketName} does not block all public access. This could expose your data to the internet.`,
							detectedAt: new Date().toISOString(),
							resourceId: bucketName,
							resourceType: "S3 Bucket",
							autoFixable: true,
							fixCommand: "Block all public access",
							metadata: {
								bucketName,
								blockPublicAcls: config?.BlockPublicAcls,
								blockPublicPolicy: config?.BlockPublicPolicy,
								ignorePublicAcls: config?.IgnorePublicAcls,
								restrictPublicBuckets: config?.RestrictPublicBuckets,
							},
						});
					}
				} catch (error) {
					if (
						(error as Error).name !== "NoSuchPublicAccessBlockConfiguration"
					) {
						redFlags.push({
							id: uuidv4(),
							category: "security_risk",
							severity: "critical",
							title: `S3 bucket ${bucketName} has no public access block`,
							description: `S3 bucket ${bucketName} does not have a public access block configuration. Enable it to prevent accidental public exposure.`,
							detectedAt: new Date().toISOString(),
							resourceId: bucketName,
							resourceType: "S3 Bucket",
							autoFixable: true,
							fixCommand: "Enable public access block",
							metadata: {
								bucketName,
							},
						});
					}
				}
			}
		} catch (error) {
			console.error("Error detecting S3 security issues:", error);
		}

		return redFlags;
	}
}
