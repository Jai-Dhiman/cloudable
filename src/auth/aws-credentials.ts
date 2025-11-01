import chalk from 'chalk';
import ora from 'ora';
import { EnvManager } from '../utils/env-manager.js';
import { PromptUtils } from '../utils/prompts.js';
import { CredentialValidator } from './credential-validator.js';
import { CredentialStorage } from './credential-storage.js';
import type { AWSCredentials, CredentialCheckResult } from '../types/aws.types.js';
import inquirer from 'inquirer';

export class AWSCredentialManager {
  /**
   * Main entry point: Get AWS credentials from any available source
   * This is the function you call from your CLI
   */
  async getCredentials(): Promise<AWSCredentials | null> {
    console.log(chalk.bold.cyan('\n🔐 AWS Authentication\n'));

    // Load .env file into process.env if it exists
    EnvManager.loadEnvFile();

    // Step 1: Check for existing credentials
    const checkResult = await this.checkExistingCredentials();

    if (checkResult.found && checkResult.location) {
      console.log(chalk.green(`✅ Found credentials in: ${checkResult.location.source}`));
      
      // Ask user if they want to use these credentials
      const useExisting = await PromptUtils.confirmUseCredentials(checkResult.location.source);
      
      if (useExisting) {
        return checkResult.location.credentials;
      } else {
        console.log(chalk.yellow('\n⚠️  User chose not to use existing credentials\n'));
      }
    } else {
      console.log(chalk.yellow('⚠️  No existing AWS credentials found\n'));
    }

    // Step 2: Credentials not found or user declined - ask for manual input
    return await this.collectCredentialsFromUser();
  }

  /**
   * Check for existing credentials in environment and .env file
   */
  private async checkExistingCredentials(): Promise<CredentialCheckResult> {
    const spinner = ora('Checking for existing AWS credentials...').start();

    // Check: Environment variables (could be from .env or manually set)
    const envCredentials = this.checkEnvironmentVariables();
    if (envCredentials) {
      spinner.stop();
      
      const validation = await CredentialValidator.validate(envCredentials);
      
      if (validation.valid) {
        // Determine source
        const source = EnvManager.envFileExists() ? '.env file' : 'environment variables';
        
        return {
          found: true,
          valid: true,
          location: {
            source: source as '.env file',
            credentials: envCredentials
          },
          identity: validation.identity
        };
      }
    }

    spinner.stop();
    return { found: false };
  }

  /**
   * Check environment variables for credentials
   */
  private checkEnvironmentVariables(): AWSCredentials | null {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION;

    if (accessKeyId && secretAccessKey && region) {
      return { accessKeyId, secretAccessKey, region };
    }

    return null;
  }

  /**
   * Collect credentials from user via prompts
   */
  private async collectCredentialsFromUser(): Promise<AWSCredentials | null> {
    try {
      // Prompt user for credentials (only 3 things, JSON output format assumed)
      const credentials = await PromptUtils.promptForCredentials();

      // Validate credentials
      const validation = await CredentialValidator.validate(credentials);

      if (!validation.valid) {
        console.log(chalk.red('\n❌ Invalid credentials. Please try again.\n'));
        
        // Ask if they want to retry
        const { retry } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: 'Would you like to try entering credentials again?',
            default: true
          }
        ]);

        if (retry) {
          return await this.collectCredentialsFromUser();
        }
        
        return null;
      }

      // Store credentials in .env file
      CredentialStorage.store(credentials);

      return credentials;
    } catch (error) {
      console.error(chalk.red('\n❌ Error collecting credentials:'), error);
      return null;
    }
  }

  /**
   * Quick check if credentials exist (doesn't validate)
   */
  hasCredentials(): boolean {
    EnvManager.loadEnvFile();
    return !!this.checkEnvironmentVariables();
  }
}

