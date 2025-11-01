import { EnvManager } from '../utils/env-manager.js';
import type { AWSCredentials } from '../types/aws.types.js';
import chalk from 'chalk';

export class CredentialStorage {
  /**
   * Store credentials in process environment (for current session)
   */
  static storeInEnvironment(credentials: AWSCredentials): void {
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
    process.env.AWS_DEFAULT_REGION = credentials.region;
    process.env.AWS_REGION = credentials.region;
  }

  /**
   * Store credentials in .env file
   */
  static storeInEnvFile(credentials: AWSCredentials): void {
    try {
      EnvManager.writeCredentials(
        credentials.accessKeyId,
        credentials.secretAccessKey,
        credentials.region
      );

      console.log(chalk.gray('\n   These credentials will work with:'));
      console.log(chalk.gray('   - Terraform (reads environment variables)'));
      console.log(chalk.gray('   - AWS SDK (reads environment variables)'));
      console.log(chalk.gray('   - Docker commands'));
      console.log(chalk.gray('   - Cloudable\n'));

      // Create .env.example for reference
      EnvManager.createEnvExample();

    } catch (error) {
      console.error(chalk.red('❌ Error saving credentials to .env file:'), error);
      throw error;
    }
  }

  /**
   * Store credentials in both environment and .env file
   */
  static store(credentials: AWSCredentials): void {
    this.storeInEnvironment(credentials);
    this.storeInEnvFile(credentials);
  }
}

