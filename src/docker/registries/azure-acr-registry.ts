import { execSync } from 'child_process';
import type { IContainerRegistry } from './registry-interface.js';
import type { RegistryAuthInfo } from '../../types/docker.types.js';

/**
 * Azure ACR (Azure Container Registry) implementation
 */
export class AzureACRRegistry implements IContainerRegistry {
  private registryName: string;
  private resourceGroup: string;

  constructor(registryName: string, resourceGroup: string) {
    this.registryName = registryName;
    this.resourceGroup = resourceGroup;
  }

  async ensureRepository(appName: string): Promise<string> {
    // In Azure ACR, repositories are created automatically on first push
    return this.getImageUri(appName);
  }

  async getAuthCredentials(): Promise<RegistryAuthInfo> {
    // Use Azure CLI to get credentials
    const credentials = JSON.parse(
      execSync(
        `az acr credential show --name ${this.registryName} --resource-group ${this.resourceGroup}`,
        { encoding: 'utf-8' }
      )
    );

    return {
      username: credentials.username,
      password: credentials.passwords[0].value,
      registry: `${this.registryName}.azurecr.io`,
    };
  }

  getImageUri(appName: string, tag: string = 'latest'): string {
    return `${this.registryName}.azurecr.io/${appName}:${tag}`;
  }

  getProviderName(): string {
    return 'Azure ACR';
  }
}

