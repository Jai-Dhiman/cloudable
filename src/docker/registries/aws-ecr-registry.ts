import { ECRClient, CreateRepositoryCommand, DescribeRepositoriesCommand } from '@aws-sdk/client-ecr';
import { execSync } from 'child_process';
import type { IContainerRegistry } from './registry-interface.js';
import type { RegistryAuthInfo } from '../../types/docker.types.js';

/**
 * AWS ECR (Elastic Container Registry) implementation
 */
export class AWSECRRegistry implements IContainerRegistry {
  private client: ECRClient;
  private region: string;
  private accountId: string;

  constructor(region: string, accountId: string) {
    this.region = region;
    this.accountId = accountId;
    this.client = new ECRClient({ region });
  }

  async ensureRepository(appName: string): Promise<string> {
    try {
      // Check if repository exists
      await this.client.send(
        new DescribeRepositoriesCommand({
          repositoryNames: [appName],
        })
      );
      return this.getImageUri(appName);
    } catch (error: any) {
      if (error.name === 'RepositoryNotFoundException') {
        // Create repository
        await this.client.send(
          new CreateRepositoryCommand({
            repositoryName: appName,
          })
        );
        return this.getImageUri(appName);
      }
      throw error;
    }
  }

  async getAuthCredentials(): Promise<RegistryAuthInfo> {
    // Use AWS CLI to get Docker login password
    const password = execSync(
      `aws ecr get-login-password --region ${this.region}`,
      { encoding: 'utf-8' }
    ).trim();

    return {
      username: 'AWS',
      password,
      registry: `${this.accountId}.dkr.ecr.${this.region}.amazonaws.com`,
    };
  }

  getImageUri(appName: string, tag: string = 'latest'): string {
    return `${this.accountId}.dkr.ecr.${this.region}.amazonaws.com/${appName}:${tag}`;
  }

  getProviderName(): string {
    return 'AWS ECR';
  }
}

