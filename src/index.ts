import { AWSCredentialManager } from './auth/aws-credentials.js';
import { EnvManager } from './utils/env-manager.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

async function main() {
  try {
    // Load .env at the very start
    dotenv.config();

    console.log(chalk.bold.cyan('🚀 Cloudable - Deploy to AWS\n'));

    // Initialize credential manager
    const credManager = new AWSCredentialManager();

    // Get credentials (checks .env or prompts user)
    const credentials = await credManager.getCredentials();

    if (!credentials) {
      console.log(chalk.red('❌ Failed to obtain AWS credentials. Exiting.'));
      process.exit(1);
    }

    console.log(chalk.green('\n✅ AWS credentials are ready!\n'));
    
    // Show where credentials are stored
    if (EnvManager.envFileExists()) {
      console.log(chalk.gray('📄 Credentials stored in: .env'));
    }

    console.log(chalk.gray('\nYou can now:'));
    console.log(chalk.gray('- Deploy with Terraform'));
    console.log(chalk.gray('- Push Docker images to ECR'));
    console.log(chalk.gray('- Use AWS SDK in your code\n'));

    // Example: Access credentials from environment
    console.log(chalk.cyan('Current AWS Configuration:'));
    console.log(chalk.gray(`Region: ${process.env.AWS_DEFAULT_REGION}`));
    console.log(chalk.gray(`Access Key: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`));
    console.log();

    // Continue with your deployment logic here
    // await analyzeProject();
    // await generateTerraformFiles();
    // await deployInfrastructure();

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
    process.exit(1);
  }
}

main();

