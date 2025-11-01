export type CloudProvider = 'aws' | 'gcp' | 'azure';

export interface RegistryAuthInfo {
  username: string;
  password: string;
  registry: string;
}

export interface AWSRegistryConfig {
  region: string;
  accountId: string;
}

export interface GCPRegistryConfig {
  projectId: string;
  region: string;
}

export interface AzureRegistryConfig {
  registryName: string;
  resourceGroup: string;
}

export type RegistryConfig = AWSRegistryConfig | GCPRegistryConfig | AzureRegistryConfig;

