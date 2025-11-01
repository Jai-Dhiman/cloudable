export type CloudProvider = 'aws' | 'gcp' | 'azure';

export type ServiceType = 'ec2';

export interface TerraformConfig {
  provider: CloudProvider;
  service: ServiceType;
  appName: string;
  region: string;
  imageUri: string;           // Docker image URI from ECR/GCR/ACR
  domainName?: string;        // Optional custom domain
  databaseType?: 'postgres' | 'mysql' | 'none';
  environment?: Record<string, string>; // Environment variables
}

export interface TerraformOutputs {
  appUrl: string;             // Main application URL
  loadBalancerUrl?: string;   // Load balancer URL (if applicable)
  databaseEndpoint?: string;  // Database endpoint (if created)
  region: string;             // AWS region
  [key: string]: any;         // Allow other outputs
}

export interface GeneratedFiles {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
  additionalFiles?: Record<string, string>; // vpc.tf, ecs.tf, etc.
}

