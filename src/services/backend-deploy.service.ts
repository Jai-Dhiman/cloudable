import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import chalk from 'chalk';
import ora from 'ora';
import { getEndpoint } from '../config/api.js';

/**
 * Backend Deployment Service
 * Handles deployments via backend API (no local AWS credentials needed)
 */
export class BackendDeployService {
  
  /**
   * Deploy project via backend API
   */
  async deployProject(projectName: string, region: string = 'us-east-1'): Promise<{
    buildId: string;
    imageUri: string;
    accountId: string;
  }> {
    const spinner = ora('Preparing project for deployment...').start();

    try {
      // Step 1: Read Dockerfile
      const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
      if (!fs.existsSync(dockerfilePath)) {
        throw new Error('Dockerfile not found. Please generate one first.');
      }
      const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
      spinner.text = 'Dockerfile loaded';

      // Step 2: Create project zip
      spinner.text = 'Zipping project files...';
      const projectZip = await this.zipProject();
      spinner.text = 'Project zipped';

      // Step 3: Send to backend API
      spinner.text = 'Uploading to deployment service...';
      const response = await fetch(getEndpoint('DEPLOY'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectName,
          projectZip,
          dockerfile,
          region
        })
      });

      if (!response.ok) {
        const error: any = await response.json();
        throw new Error(error.error || 'Deployment failed');
      }

      const result: any = await response.json();
      spinner.succeed(chalk.green('Project uploaded successfully'));

      if (!result.success) {
        throw new Error(result.error || 'Deployment failed');
      }

      return result.data;

    } catch (error: any) {
      spinner.fail(chalk.red('Deployment preparation failed'));
      throw error;
    }
  }

  /**
   * Check build status
   */
  async checkBuildStatus(buildId: string, region: string = 'us-east-1'): Promise<{
    status: string;
    phase: string;
    logs?: { groupName?: string; streamName?: string };
  }> {
    const baseUrl = getEndpoint('DEPLOY_STATUS');
    const statusUrl = `${baseUrl}/${buildId}?region=${region}`;
    const response = await fetch(statusUrl);

    if (!response.ok) {
      throw new Error('Failed to check build status');
    }

    const result: any = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Status check failed');
    }

    return result.data;
  }

  /**
   * Wait for build to complete
   */
  async waitForBuild(buildId: string, region: string = 'us-east-1'): Promise<string> {
    const spinner = ora('Building Docker image remotely...').start();

    let attempt = 0;
    const maxAttempts = 120; // 10 minutes max

    while (attempt < maxAttempts) {
      try {
        const status = await this.checkBuildStatus(buildId, region);

        if (status.status === 'SUCCEEDED') {
          spinner.succeed(chalk.green('✅ Docker image built and pushed'));
          return 'SUCCEEDED';
        } else if (
          status.status === 'FAILED' ||
          status.status === 'FAULT' ||
          status.status === 'STOPPED' ||
          status.status === 'TIMED_OUT'
        ) {
          spinner.fail(chalk.red(`❌ Build ${status.status.toLowerCase()}`));
          
          // Fetch and display CloudWatch logs
          if (status.logs?.groupName && status.logs?.streamName) {
            console.log(chalk.yellow('\n📋 Build Logs:\n'));
            await this.fetchAndDisplayLogs(status.logs.groupName, status.logs.streamName, region);
          }
          
          throw new Error(`Build ${status.status.toLowerCase()}`);
        }

        // Still in progress
        const elapsed = attempt * 5;
        spinner.text = `Building remotely... (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`;
        
        await this.sleep(5000); // Wait 5 seconds
        attempt++;
      } catch (error: any) {
        spinner.fail(chalk.red('❌ Build monitoring failed'));
        throw error;
      }
    }

    spinner.fail(chalk.red('❌ Build timeout'));
    throw new Error('Build timed out after 10 minutes');
  }

  /**
   * Zip project files
   */
  private zipProject(): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('base64'));
      });
      archive.on('error', (err: Error) => reject(err));

      // Add all files except ignored directories
      const ignorePatterns = [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        '.next/**',
        'out/**',
        '__pycache__/**',
        'venv/**',
        '.venv/**',
        'target/**',
        '.env',
        '.env.local',
        'terraform/**'
      ];

      archive.glob('**/*', {
        cwd: process.cwd(),
        ignore: ignorePatterns,
        dot: true
      });

      archive.finalize();
    });
  }

  /**
   * Fetch and display CloudWatch logs
   */
  private async fetchAndDisplayLogs(groupName: string, streamName: string, region: string): Promise<void> {
    try {
      const baseUrl = getEndpoint('DEPLOY_STATUS');
      const logsUrl = `${baseUrl}/logs?groupName=${encodeURIComponent(groupName)}&streamName=${encodeURIComponent(streamName)}&region=${region}`;
      
      const response = await fetch(logsUrl);
      
      if (!response.ok) {
        console.log(chalk.gray('(Could not fetch logs)'));
        return;
      }
      
      const result: any = await response.json();
      
      if (result.success && result.data?.logs) {
        const logs = result.data.logs;
        logs.forEach((log: string) => {
          // Color error lines red
          if (log.toLowerCase().includes('error') || log.toLowerCase().includes('failed')) {
            console.log(chalk.red(log));
          } else if (log.toLowerCase().includes('warning')) {
            console.log(chalk.yellow(log));
          } else {
            console.log(chalk.gray(log));
          }
        });
      }
    } catch (error) {
      console.log(chalk.gray('(Could not fetch logs)'));
    }
  }

  /**
   * Helper: Sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

