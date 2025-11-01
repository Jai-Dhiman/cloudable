import { DockerBuilder } from './docker-builder.js';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

async function testDockerIntegration() {
  try {
    // Load environment variables
    dotenv.config();

    console.log(chalk.bold.cyan('🧪 Testing Docker Builder Integration\n'));

    // Check for required environment variables
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} not found in .env file`);
      }
    }

    console.log(chalk.green('✅ All required environment variables found\n'));

    // Get AWS credentials
    const region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const stsClient = new STSClient({ region });
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    const accountId = identity.Account!;

    console.log(chalk.gray(`AWS Account: ${accountId}`));
    console.log(chalk.gray(`Region: ${region}\n`));

    // Create Docker builder
    const dockerBuilder = new DockerBuilder('aws', {
      region,
      accountId
    });

    // Build and push (this will auto-generate Dockerfile if needed)
    const appName = 'test-app';
    const imageUri = await dockerBuilder.buildAndPush(appName);

    console.log(chalk.bold.green('\n🎉 Integration Test Successful!\n'));
    console.log(chalk.cyan('Image URI:'));
    console.log(chalk.white(imageUri));
    console.log();

  } catch (error: any) {
    console.error(chalk.red('\n❌ Integration test failed:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

testDockerIntegration();

