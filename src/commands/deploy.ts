import { Command, Flags, Args } from '@oclif/core';
import { DockerBuilder } from '../docker/docker-builder.js';
import { TerraformGenerator } from '../terraform/terraform-generator.js';
import { TerraformRunner } from '../terraform/terraform-runner.js';
import { TerraformOutputParser } from '../terraform/terraform-output-parser.js';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import type { ServiceType } from '../types/terraform.types.js';
import chalk from 'chalk';

export default class Deploy extends Command {
  static description = 'Complete deployment: Build Docker image, push to registry, and deploy with Terraform to AWS EC2';

  static examples = [
    '<%= config.bin %> <%= command.id %> my-app',
    '<%= config.bin %> <%= command.id %> my-app --region us-west-2',
    '<%= config.bin %> <%= command.id %> my-app --remote',
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
      description: 'Build Docker image remotely using AWS CodeBuild',
      default: false,
    }),
  };

  static args = {
    appName: Args.string({
      name: 'appName',
      required: true,
      description: 'Name of your application',
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Deploy);

    try {
      console.log(chalk.bold.cyan('\n🚀 Cloudable Complete Deployment\n'));
      console.log(chalk.gray('═'.repeat(60)));

      // Validate inputs
      const provider = flags.provider as 'aws' | 'gcp' | 'azure';
      const service = 'ec2' as ServiceType; // Fixed to EC2

      if (!['aws', 'gcp', 'azure'].includes(provider)) {
        this.error(chalk.red(`Invalid provider: ${provider}`));
      }

      // STEP 1: Get AWS credentials
      console.log(chalk.bold.cyan('\n📋 Step 1/4: Verifying AWS Credentials\n'));

      const stsClient = new STSClient({ region: flags.region });
      const identity = await stsClient.send(new GetCallerIdentityCommand({}));
      const accountId = identity.Account!;

      console.log(chalk.gray(`   AWS Account: ${accountId}`));
      console.log(chalk.gray(`   Region: ${flags.region}`));
      console.log(chalk.gray(`   Service: EC2 (Docker container)\n`));

      // STEP 2: Build & Push Docker Image
      console.log(chalk.bold.cyan('📦 Step 2/4: Build & Push Docker Image\n'));

      const dockerBuilder = new DockerBuilder(provider, {
        region: flags.region,
        accountId,
      });

      const imageUri = await dockerBuilder.buildAndPush(args.appName, flags.remote);

      console.log(chalk.green(`\n✅ Docker image ready: ${imageUri}\n`));

      // STEP 3: Generate Terraform Configuration
      console.log(chalk.bold.cyan('📝 Step 3/4: Generate Terraform Configuration\n'));

      const terraformDir = './terraform';
      const terraformGen = new TerraformGenerator(terraformDir);

      await terraformGen.generate({
        provider,
        service,
        appName: args.appName,
        region: flags.region,
        imageUri,
      });

      // STEP 4: Deploy with Terraform
      console.log(chalk.bold.cyan('🏗️  Step 4/4: Deploy Infrastructure\n'));

      const terraformRunner = new TerraformRunner(terraformDir);
      await terraformRunner.init();
      await terraformRunner.plan();
      await terraformRunner.apply();

      // STEP 5: Get and Display URL
      const outputs = await terraformRunner.getOutputs() as any;

      if (TerraformOutputParser.validate(outputs)) {
        TerraformOutputParser.displayResults(outputs);
      }

      console.log(chalk.gray('═'.repeat(60)));
      console.log(chalk.bold.green('\n✅ Deployment Complete!\n'));

    } catch (error: any) {
      this.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }
}

