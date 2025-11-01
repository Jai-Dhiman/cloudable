import {
  CodeBuildClient,
  CreateProjectCommand,
  StartBuildCommand,
  BatchGetBuildsCommand,
  UpdateProjectCommand,
} from '@aws-sdk/client-codebuild';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import chalk from 'chalk';
import ora from 'ora';

export interface RemoteBuilderConfig {
  region: string;
  accountId: string;
  appName: string;
}

/**
 * AWS CodeBuild Remote Builder
 * Builds Docker images in the cloud without needing local Docker installation
 */
export class AWSRemoteBuilder {
  private codeBuildClient: CodeBuildClient;
  private s3Client: S3Client;
  private config: RemoteBuilderConfig;
  private bucketName: string;

  constructor(config: RemoteBuilderConfig) {
    this.config = config;
    this.codeBuildClient = new CodeBuildClient({ region: config.region });
    this.s3Client = new S3Client({ region: config.region });
    this.bucketName = `cloudable-builds-${config.accountId}`;
  }

  /**
   * Main method: Build Docker image remotely using AWS CodeBuild
   */
  async buildAndPush(): Promise<string> {
    try {
      console.log(chalk.cyan('🌩️  Remote Build Mode: AWS CodeBuild\n'));

      // Step 1: Ensure S3 bucket exists
      await this.ensureBucketExists();

      // Step 2: Zip and upload source code
      const sourceKey = await this.uploadSourceCode();

      // Step 3: Ensure CodeBuild project exists
      await this.ensureCodeBuildProject();

      // Step 4: Start the build
      const buildId = await this.startBuild(sourceKey);

      // Step 5: Wait for build to complete
      const imageUri = await this.waitForBuild(buildId);

      return imageUri;
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Remote build failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Ensure S3 bucket exists for storing build artifacts
   */
  private async ensureBucketExists(): Promise<void> {
    const spinner = ora('Setting up S3 bucket for builds...').start();

    try {
      // Check if bucket exists
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucketName })
      );
      spinner.succeed(chalk.green('✅ S3 bucket ready'));
    } catch (error: any) {
      if (error.name === 'NotFound') {
        // Create bucket
        try {
          await this.s3Client.send(
            new CreateBucketCommand({ Bucket: this.bucketName })
          );
          spinner.succeed(chalk.green('✅ S3 bucket created'));
        } catch (createError: any) {
          spinner.fail(chalk.red('❌ Failed to create S3 bucket'));
          throw createError;
        }
      } else {
        spinner.fail(chalk.red('❌ S3 bucket check failed'));
        throw error;
      }
    }
  }

  /**
   * Zip source code and upload to S3
   */
  private async uploadSourceCode(): Promise<string> {
    const spinner = ora('Packaging source code...').start();

    try {
      // Create zip file
      const zipPath = path.join(process.cwd(), '.cloudable-build.zip');
      await this.zipSourceCode(zipPath);

      spinner.text = 'Uploading to S3...';

      // Upload to S3
      const sourceKey = `${this.config.appName}/${Date.now()}.zip`;
      const fileStream = fs.createReadStream(zipPath);

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: sourceKey,
          Body: fileStream,
        })
      );

      // Clean up local zip
      fs.unlinkSync(zipPath);

      spinner.succeed(chalk.green('✅ Source code uploaded'));
      return sourceKey;
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Source upload failed'));
      throw error;
    }
  }

  /**
   * Zip source code (excluding node_modules, .git, etc.)
   */
  private zipSourceCode(outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err: Error) => reject(err));

      archive.pipe(output);

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
        '.cloudable-build.zip',
        '.env',
        '.env.local',
      ];

      archive.glob('**/*', {
        cwd: process.cwd(),
        ignore: ignorePatterns,
        dot: true,
      });

      archive.finalize();
    });
  }

  /**
   * Ensure CodeBuild project exists
   */
  private async ensureCodeBuildProject(): Promise<void> {
    const spinner = ora('Setting up CodeBuild project...').start();
    const projectName = `cloudable-${this.config.appName}`;

    try {
      // Try to update existing project
      await this.codeBuildClient.send(
        new UpdateProjectCommand({
          name: projectName,
          ...this.getProjectConfig(),
        })
      );
      spinner.succeed(chalk.green('✅ CodeBuild project ready'));
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        // Create new project
        try {
          await this.codeBuildClient.send(
            new CreateProjectCommand({
              name: projectName,
              ...this.getProjectConfig(),
            })
          );
          spinner.succeed(chalk.green('✅ CodeBuild project created'));
        } catch (createError: any) {
          spinner.fail(chalk.red('❌ Failed to create CodeBuild project'));
          throw createError;
        }
      } else {
        spinner.fail(chalk.red('❌ CodeBuild project setup failed'));
        throw error;
      }
    }
  }

  /**
   * Get CodeBuild project configuration
   */
  private getProjectConfig() {
    const ecrRepo = `${this.config.accountId}.dkr.ecr.${this.config.region}.amazonaws.com/${this.config.appName}`;

    return {
      source: {
        type: 'S3' as const,
        location: `${this.bucketName}/${this.config.appName}/source.zip`,
      },
      artifacts: {
        type: 'NO_ARTIFACTS' as const,
      },
      environment: {
        type: 'LINUX_CONTAINER' as const,
        image: 'aws/codebuild/standard:7.0',
        computeType: 'BUILD_GENERAL1_SMALL' as const,
        privilegedMode: true,
        environmentVariables: [
          {
            name: 'AWS_DEFAULT_REGION',
            value: this.config.region,
          },
          {
            name: 'AWS_ACCOUNT_ID',
            value: this.config.accountId,
          },
          {
            name: 'IMAGE_REPO_NAME',
            value: this.config.appName,
          },
          {
            name: 'IMAGE_TAG',
            value: 'latest',
          },
        ],
      },
      serviceRole: `arn:aws:iam::${this.config.accountId}:role/CloudableCodeBuildRole`,
    };
  }

  /**
   * Start CodeBuild build
   */
  private async startBuild(sourceKey: string): Promise<string> {
    const spinner = ora('Starting remote build...').start();
    const projectName = `cloudable-${this.config.appName}`;

    try {
      const response = await this.codeBuildClient.send(
        new StartBuildCommand({
          projectName,
          sourceLocationOverride: `${this.bucketName}/${sourceKey}`,
          buildspecOverride: this.getBuildSpec(),
        })
      );

      const buildId = response.build?.id;
      if (!buildId) {
        throw new Error('Failed to get build ID');
      }

      spinner.succeed(chalk.green('✅ Build started'));
      console.log(chalk.gray(`Build ID: ${buildId}\n`));

      return buildId;
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Failed to start build'));
      throw error;
    }
  }

  /**
   * Get buildspec.yml content
   */
  private getBuildSpec(): string {
    return `version: 0.2

phases:
  pre_build:
    commands:
      - echo Logging in to Amazon ECR...
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com
      - REPOSITORY_URI=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$IMAGE_REPO_NAME
      - COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)
      - IMAGE_TAG=\${COMMIT_HASH:-latest}
  build:
    commands:
      - echo Build started on \`date\`
      - echo Building the Docker image...
      - docker build -t $REPOSITORY_URI:latest .
      - docker tag $REPOSITORY_URI:latest $REPOSITORY_URI:$IMAGE_TAG
  post_build:
    commands:
      - echo Build completed on \`date\`
      - echo Pushing the Docker images...
      - docker push $REPOSITORY_URI:latest
      - docker push $REPOSITORY_URI:$IMAGE_TAG
      - echo Image pushed to $REPOSITORY_URI:latest
`;
  }

  /**
   * Wait for build to complete and return image URI
   */
  private async waitForBuild(buildId: string): Promise<string> {
    const spinner = ora('Building Docker image remotely (this may take a few minutes)...').start();

    let attempt = 0;
    const maxAttempts = 120; // 10 minutes max

    while (attempt < maxAttempts) {
      try {
        const response = await this.codeBuildClient.send(
          new BatchGetBuildsCommand({ ids: [buildId] })
        );

        const build = response.builds?.[0];
        if (!build) {
          throw new Error('Build not found');
        }

        const status = build.buildStatus;

        if (status === 'SUCCEEDED') {
          spinner.succeed(chalk.green('✅ Docker image built and pushed'));
          const imageUri = `${this.config.accountId}.dkr.ecr.${this.config.region}.amazonaws.com/${this.config.appName}:latest`;
          return imageUri;
        } else if (status === 'FAILED' || status === 'FAULT' || status === 'STOPPED' || status === 'TIMED_OUT') {
          spinner.fail(chalk.red(`❌ Build ${status.toLowerCase()}`));
          throw new Error(`Build ${status.toLowerCase()}: ${build.buildNumber}`);
        }

        // Still in progress
        spinner.text = `Building remotely... (${Math.floor(attempt * 5 / 60)}m ${(attempt * 5) % 60}s)`;
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
   * Helper: Sleep for ms
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

