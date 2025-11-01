import type { RegistryAuthInfo } from '../../types/docker.types.js';

/**
 * Interface for container registry operations
 * Supports AWS ECR, GCP Artifact Registry, Azure ACR
 */
export interface IContainerRegistry {
  /**
   * Ensure the repository exists in the registry
   * Creates it if it doesn't exist
   */
  ensureRepository(appName: string): Promise<string>;

  /**
   * Get authentication credentials for Docker login
   */
  getAuthCredentials(): Promise<RegistryAuthInfo>;

  /**
   * Get the full image URI for pushing
   */
  getImageUri(appName: string, tag?: string): string;

  /**
   * Get the provider name (for display purposes)
   */
  getProviderName(): string;
}

