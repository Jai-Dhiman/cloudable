import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import type { AWSCredentials, AWSIdentity } from '../types/aws.types.js';
import chalk from 'chalk';
import ora from 'ora';

export class CredentialValidator {
  /**
   * Validate AWS credentials by calling AWS STS GetCallerIdentity
   * This is a simple API call that verifies credentials work
   */
  static async validate(credentials: AWSCredentials): Promise<{
    valid: boolean;
    identity?: AWSIdentity;
    error?: string;
  }> {
    const spinner = ora('Validating AWS credentials...').start();

    try {
      const client = new STSClient({
        region: credentials.region,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey
        }
      });

      const command = new GetCallerIdentityCommand({});
      const response = await client.send(command);

      spinner.succeed(chalk.green('✅ Credentials validated successfully!'));

      console.log(chalk.gray(`\nAuthenticated as: ${response.Arn}`));
      console.log(chalk.gray(`Account ID: ${response.Account}\n`));

      return {
        valid: true,
        identity: {
          userId: response.UserId || '',
          account: response.Account || '',
          arn: response.Arn || ''
        }
      };
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Credential validation failed'));

      let errorMessage = 'Unknown error';
      
      if (error.name === 'InvalidClientTokenId') {
        errorMessage = 'Invalid Access Key ID';
      } else if (error.name === 'SignatureDoesNotMatch') {
        errorMessage = 'Invalid Secret Access Key';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.error(chalk.red(`Error: ${errorMessage}\n`));

      return {
        valid: false,
        error: errorMessage
      };
    }
  }
}

