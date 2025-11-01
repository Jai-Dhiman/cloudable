import { Command, Flags, Args } from '@oclif/core';
import { DockerBuilder } from '../docker/docker-builder.js';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import chalk from 'chalk';

export default class Build extends Command {
  static description = 'Build Docker image and push to cloud registry (auto-generates Dockerfile with AI if needed)';

  static examples = [
    '<%= config.bin %> <%= command.id %> my-app',
    '<%= config.bin %> <%= command.id %> my-app --provider aws --region us-west-2',
  ];

  static flags = {
    provider: Flags.string({
      char: 'p',
      description: 'Cloud provider (aws, gcp, azure)',
      default: 'aws',
    }),
    region: Flags.string({
      char: 'r',
      description: 'Cloud region',
      default: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    }),
    remote: Flags.boolean({
      description: 'Build remotely using AWS CodeBuild (no local Docker needed)',
      default: false,
    }),
  };

  static args = {
    appName: Args.string({
      name: 'appName',
      required: true,
      description: 'Name of your application (used for Docker image name)',
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Build);

    try {
      console.log(chalk.bold.cyan('\n🚀 Cloudable Docker Build & Deploy\n'));

      // Validate provider
      const provider = flags.provider as 'aws' | 'gcp' | 'azure';
      if (!['aws', 'gcp', 'azure'].includes(provider)) {
        this.error(chalk.red(`Invalid provider: ${provider}. Must be aws, gcp, or azure`));
      }

      // Get registry config based on provider
      let registryConfig: any;

      if (provider === 'aws') {
        // Get AWS account ID
        const stsClient = new STSClient({ region: flags.region });
        const identity = await stsClient.send(new GetCallerIdentityCommand({}));
        registryConfig = {
          region: flags.region,
          accountId: identity.Account!,
        };
        console.log(chalk.gray(`AWS Account: ${identity.Account}`));
        console.log(chalk.gray(`Region: ${flags.region}\n`));
      } else if (provider === 'gcp') {
        // GCP config - would need project ID from env or flag
        registryConfig = {
          projectId: process.env.GCP_PROJECT_ID || '',
          region: flags.region,
        };
        if (!registryConfig.projectId) {
          this.error(chalk.red('GCP_PROJECT_ID environment variable required for GCP'));
        }
      } else if (provider === 'azure') {
        // Azure config - would need from env or flags
        registryConfig = {
          registryName: process.env.AZURE_REGISTRY_NAME || '',
          resourceGroup: process.env.AZURE_RESOURCE_GROUP || '',
        };
        if (!registryConfig.registryName || !registryConfig.resourceGroup) {
          this.error(chalk.red('AZURE_REGISTRY_NAME and AZURE_RESOURCE_GROUP environment variables required'));
        }
      }

      // Create Docker builder
      const dockerBuilder = new DockerBuilder(provider, registryConfig);

      // Show build mode
      if (flags.remote) {
        console.log(chalk.cyan('Build Mode: Remote (AWS CodeBuild)'));
        console.log(chalk.gray('No local Docker installation required\n'));
      } else {
        console.log(chalk.cyan('Build Mode: Local'));
        console.log(chalk.gray('Using local Docker installation\n'));
      }

      // Build and push (auto-generates Dockerfile if needed)
      const imageUri = await dockerBuilder.buildAndPush(args.appName, flags.remote);

      console.log(chalk.bold.green('\n🎉 Success!\n'));
      console.log(chalk.cyan('Your Docker image is ready:'));
      console.log(chalk.white(imageUri));
      console.log();
      console.log(chalk.gray('Next steps:'));
      console.log(chalk.gray(`  1. Deploy to your cloud infrastructure`));
      console.log(chalk.gray(`  2. Pull image: docker pull ${imageUri}`));
      console.log(chalk.gray(`  3. Run locally: docker run -p 3000:3000 ${imageUri}\n`));

    } catch (error: any) {
      this.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }
}

