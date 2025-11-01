import { execSync } from 'child_process';
import type { IContainerRegistry } from './registry-interface.js';
import type { RegistryAuthInfo } from '../../types/docker.types.js';

/**
 * GCP Artifact Registry implementation
 */
export class GCPArtifactRegistry implements IContainerRegistry {
  private projectId: string;
  private region: string;

  constructor(projectId: string, region: string) {
    this.projectId = projectId;
    this.region = region;
  }

  async ensureRepository(appName: string): Promise<string> {
    // In GCP Artifact Registry, repositories are created manually
    // This would need gcloud CLI or API calls to create
    return this.getImageUri(appName);
  }

  async getAuthCredentials(): Promise<RegistryAuthInfo> {
    // Use gcloud to get access token
    const token = execSync('gcloud auth print-access-token', {
      encoding: 'utf-8',
    }).trim();

    return {
      username: 'oauth2accesstoken',
      password: token,
      registry: `${this.region}-docker.pkg.dev`,
    };
  }

  getImageUri(appName: string, tag: string = 'latest'): string {
    return `${this.region}-docker.pkg.dev/${this.projectId}/docker-images/${appName}:${tag}`;
  }

  getProviderName(): string {
    return 'GCP Artifact Registry';
  }
}

