import { spawn } from 'child_process';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { AIDockerGenerator } from './ai-docker-generator.js';
import { AWSRemoteBuilder } from './remote-builder.js';
import type { IContainerRegistry } from './registries/registry-interface.js';
import { AWSECRRegistry } from './registries/aws-ecr-registry.js';
import { GCPArtifactRegistry } from './registries/gcp-artifact-registry.js';
import { AzureACRRegistry } from './registries/azure-acr-registry.js';
import type { CloudProvider } from '../types/docker.types.js';

export class DockerBuilder {
  private registry: IContainerRegistry;
  private provider: CloudProvider;
  private registryConfig: any;

  constructor(provider: CloudProvider, registryConfig: any) {
    this.provider = provider;
    this.registryConfig = registryConfig;

    // Create appropriate registry based on provider
    switch (provider) {
      case 'aws':
        this.registry = new AWSECRRegistry(registryConfig.region, registryConfig.accountId);
        break;
      case 'gcp':
        this.registry = new GCPArtifactRegistry(registryConfig.projectId, registryConfig.region);
        break;
      case 'azure':
        this.registry = new AzureACRRegistry(registryConfig.registryName, registryConfig.resourceGroup);
        break;
      default:
        throw new Error(`Unsupported cloud provider: ${provider}`);
    }
  }

  /**
   * Main method: Build Docker image and push to cloud registry
   */
  async buildAndPush(appName: string, useRemoteBuild: boolean = false): Promise<string> {
    try {
      console.log(chalk.bold.cyan(`\n🐳 Docker Build & Push (${this.registry.getProviderName()})\n`));

      // STEP 1: Ensure Dockerfile exists (generate with AI if needed)
      await this.ensureDockerfileExists();

      let fullImageUri: string;

      if (useRemoteBuild && this.provider === 'aws') {
        // Remote build using AWS CodeBuild
        fullImageUri = await this.buildRemote(appName);
      } else {
        // Local build (original flow)
        fullImageUri = await this.buildLocal(appName);
      }

      console.log(chalk.green(`\n✅ Image available at: ${fullImageUri}\n`));

      return fullImageUri;

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Docker build failed: ${error.message}\n`));
      throw error;
    }
  }

  /**
   * Build remotely using AWS CodeBuild (no local Docker needed)
   */
  private async buildRemote(appName: string): Promise<string> {
    if (this.provider !== 'aws') {
      throw new Error('Remote builds currently only supported for AWS');
    }

    // Ensure ECR repository exists first
    await this.registry.ensureRepository(appName);

    const remoteBuilder = new AWSRemoteBuilder({
      region: this.registryConfig.region,
      accountId: this.registryConfig.accountId,
      appName,
    });

    return await remoteBuilder.buildAndPush();
  }

  /**
   * Build locally using Docker Desktop (original flow)
   */
  private async buildLocal(appName: string): Promise<string> {
    // STEP 2: Build Docker image locally
    await this.buildImage(appName);

    // STEP 3-7: Push to registry
    await this.registry.ensureRepository(appName);
    const authInfo = await this.registry.getAuthCredentials();
    await this.loginToRegistry(authInfo);
    const fullImageUri = this.registry.getImageUri(appName);
    await this.tagImage(appName, fullImageUri);
    await this.pushToRegistry(fullImageUri);

    return fullImageUri;
  }

  /**
   * Ensure Dockerfile exists (generate with AI if needed)
   * This method checks if a Dockerfile exists in the current directory.
   * If not, it uses AI to generate one.
   */
  private async ensureDockerfileExists(): Promise<void> {
    // Check if Dockerfile already exists
    if (fs.existsSync('Dockerfile')) {
      console.log(chalk.green('✅ Found existing Dockerfile\n'));
      return;
    }

    // No Dockerfile found - generate with AI
    console.log(chalk.yellow('⚠️  No Dockerfile found'));
    console.log(chalk.cyan('🤖 Generating Dockerfile using AI...\n'));
    
    try {
      const aiGenerator = new AIDockerGenerator();
      await aiGenerator.generate();
      
      // Verify Dockerfile was created
      if (!fs.existsSync('Dockerfile')) {
        throw new Error('AI generator did not create a Dockerfile');
      }
      
      console.log(chalk.green('✅ AI-generated Dockerfile is ready\n'));
      
    } catch (error: any) {
      console.error(chalk.red('❌ Failed to generate Dockerfile with AI'));
      console.error(chalk.red(`   Error: ${error.message}`));
      console.log(chalk.yellow('\n💡 Tip: Make sure OPENAI_API_KEY is set in your .env file\n'));
      throw new Error('Could not generate Dockerfile. Please create one manually or check your OpenAI API key.');
    }
  }

  /**
   * Build Docker image locally
   */
  private async buildImage(appName: string): Promise<void> {
    const spinner = ora('Building Docker image...').start();

    try {
      await this.runCommand('docker', ['build', '-t', appName, '.'], true);
      spinner.succeed(chalk.green('✅ Docker image built'));
    } catch (error) {
      spinner.fail(chalk.red('❌ Docker build failed'));
      throw error;
    }
  }

  /**
   * Login to container registry
   */
  private async loginToRegistry(authInfo: any): Promise<void> {
    const spinner = ora(`Logging in to ${this.registry.getProviderName()}...`).start();

    try {
      await this.runCommand(
        'docker',
        ['login', '--username', authInfo.username, '--password-stdin', authInfo.registry],
        false,
        authInfo.password
      );

      spinner.succeed(chalk.green(`✅ Logged in to ${this.registry.getProviderName()}`));
    } catch (error) {
      spinner.fail(chalk.red('❌ Registry login failed'));
      throw error;
    }
  }

  /**
   * Tag Docker image for registry
   */
  private async tagImage(appName: string, fullImageUri: string): Promise<void> {
    const spinner = ora('Tagging Docker image...').start();

    try {
      await this.runCommand('docker', ['tag', appName, fullImageUri], false);
      spinner.succeed(chalk.green('✅ Image tagged'));
    } catch (error) {
      spinner.fail(chalk.red('❌ Image tagging failed'));
      throw error;
    }
  }

  /**
   * Push Docker image to registry
   */
  private async pushToRegistry(fullImageUri: string): Promise<void> {
    const spinner = ora('Pushing image to registry (this may take a few minutes)...').start();

    try {
      await this.runCommand('docker', ['push', fullImageUri], true);
      spinner.succeed(chalk.green('✅ Image pushed successfully'));
    } catch (error) {
      spinner.fail(chalk.red('❌ Image push failed'));
      throw error;
    }
  }

  /**
   * Helper: Run a shell command
   */
  private runCommand(
    command: string,
    args: string[],
    showOutput: boolean = false,
    stdin?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        stdio: stdin ? 'pipe' : (showOutput ? 'inherit' : 'pipe')
      });

      if (stdin) {
        childProcess.stdin?.write(stdin);
        childProcess.stdin?.end();
      }

      let stderr = '';

      if (!showOutput) {
        childProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} exited with code ${code}${stderr ? ': ' + stderr : ''}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
}

