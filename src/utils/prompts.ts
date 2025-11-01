import inquirer from 'inquirer';
import chalk from 'chalk';

export class PromptUtils {
  /**
   * Prompt user for AWS credentials (only 3 things, assume JSON for output format)
   */
  static async promptForCredentials(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }> {
    console.log(chalk.cyan('\n📋 AWS Credentials Setup\n'));
    console.log(chalk.gray('To get your AWS credentials:'));
    console.log(chalk.gray('1. Go to: https://console.aws.amazon.com/iam/home#/security_credentials'));
    console.log(chalk.gray('2. Click "Create access key"'));
    console.log(chalk.gray('3. Select "Command Line Interface (CLI)"'));
    console.log(chalk.gray('4. Copy the credentials below\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'accessKeyId',
        message: 'AWS Access Key ID:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Access Key ID is required';
          }
          if (input.length < 16) {
            return 'Access Key ID seems too short';
          }
          return true;
        }
      },
      {
        type: 'password',
        name: 'secretAccessKey',
        message: 'AWS Secret Access Key:',
        mask: '*',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Secret Access Key is required';
          }
          if (input.length < 20) {
            return 'Secret Access Key seems too short';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'region',
        message: 'AWS Region:',
        default: 'us-east-1',
        validate: (input: string) => {
          const regionPattern = /^[a-z]{2}-[a-z]+-\d{1}$/;
          if (!regionPattern.test(input)) {
            return 'Invalid region format (e.g., us-east-1, eu-west-2)';
          }
          return true;
        }
      }
    ]);

    // Output format is automatically assumed to be JSON (4th parameter)
    return answers;
  }

  /**
   * Ask user if they want to use found credentials
   */
  static async confirmUseCredentials(source: string): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Found AWS credentials in ${source}. Use these credentials?`,
        default: true
      }
    ]);

    return confirm;
  }
}

