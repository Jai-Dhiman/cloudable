import { Command, Flags } from '@oclif/core';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as readline from 'readline';

export default class Setup extends Command {
  static description = 'Interactive setup for AWS credentials and configuration';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  static flags = {
    global: Flags.boolean({
      char: 'g',
      description: 'Save to global ~/.cloudable.env instead of current directory',
      default: false,
    }),
    'access-key': Flags.string({
      description: 'AWS Access Key ID (non-interactive)',
      required: false,
    }),
    'secret-key': Flags.string({
      description: 'AWS Secret Access Key (non-interactive)',
      required: false,
    }),
    region: Flags.string({
      description: 'AWS Region (non-interactive)',
      required: false,
      default: 'us-east-1',
    }),
  };

  private rl!: readline.Interface;

  public async run(): Promise<void> {
    const { flags } = await this.parse(Setup);

    try {
      console.log(chalk.bold.cyan('\n🚀 Cloudable AWS Setup\n'));
      console.log(chalk.gray('This will configure your AWS credentials for Cloudable\n'));

      let accessKeyId: string;
      let secretAccessKey: string;
      let region: string;

      // Check if running non-interactively (flags provided)
      if (flags['access-key'] && flags['secret-key']) {
        accessKeyId = flags['access-key'];
        secretAccessKey = flags['secret-key'];
        region = flags.region;
        console.log(chalk.gray('Using provided credentials...\n'));
      } else {
        // Interactive mode
        this.rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        // Get AWS credentials
        accessKeyId = await this.prompt('AWS Access Key ID: ');
        secretAccessKey = await this.prompt('AWS Secret Access Key: ', true);
        region = await this.prompt('AWS Region (default: us-east-1): ') || 'us-east-1';
      }

      // Validate credentials
      console.log(chalk.cyan('\n🔍 Validating credentials...\n'));
      
      const isValid = await this.validateCredentials(accessKeyId, secretAccessKey, region);
      
      if (!isValid) {
        console.log(chalk.red('❌ Invalid AWS credentials. Please try again.\n'));
        if (this.rl) {
          this.rl.close();
        }
        return;
      }

      // Save to .env - merge with existing variables
      const envPath = flags.global
        ? path.join(process.env.HOME || '', '.cloudable.env')
        : path.join(process.cwd(), '.env');

      // Read existing .env file if it exists
      let existingEnv: Record<string, string> = {};
      let existingComments: string[] = [];
      
      if (fs.existsSync(envPath)) {
        const existingContent = fs.readFileSync(envPath, 'utf-8');
        const lines = existingContent.split('\n');
        
        // Parse existing env variables and preserve comments
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || trimmed === '') {
            // Preserve comments and empty lines (except AWS-related ones)
            if (!trimmed.includes('Cloudable AWS Configuration')) {
              existingComments.push(line);
            }
          } else {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
              const key = match[1].trim();
              const value = match[2].trim();
              // Don't preserve old AWS credentials
              if (!key.startsWith('AWS_')) {
                existingEnv[key] = value;
              }
            }
          }
        }

        // In interactive mode, ask for confirmation
        if (!flags['access-key'] || !flags['secret-key']) {
          const overwrite = await this.prompt(
            chalk.yellow(`\n⚠️  ${envPath} already exists. Update AWS credentials? (y/n): `)
          );
          
          if (overwrite.toLowerCase() !== 'y') {
            console.log(chalk.yellow('\n❌ Setup cancelled\n'));
            if (this.rl) {
              this.rl.close();
            }
            return;
          }
        } else {
          console.log(chalk.gray(`Updating AWS credentials in ${envPath}...\n`));
        }
      }

      // Build new .env content
      let envContent = '';
      
      // Add existing comments and non-AWS variables first
      if (existingComments.length > 0 || Object.keys(existingEnv).length > 0) {
        if (existingComments.length > 0) {
          envContent += existingComments.join('\n') + '\n';
          if (Object.keys(existingEnv).length > 0) {
            envContent += '\n';
          }
        }
        
        for (const [key, value] of Object.entries(existingEnv)) {
          envContent += `${key}=${value}\n`;
        }
        
        if (Object.keys(existingEnv).length > 0) {
          envContent += '\n';
        }
      }
      
      // Add AWS credentials
      envContent += `# Cloudable AWS Configuration\n`;
      envContent += `AWS_ACCESS_KEY_ID=${accessKeyId}\n`;
      envContent += `AWS_SECRET_ACCESS_KEY=${secretAccessKey}\n`;
      envContent += `AWS_DEFAULT_REGION=${region}\n`;

      fs.writeFileSync(envPath, envContent, 'utf-8');

      console.log(chalk.bold.green('\n✅ Setup complete!\n'));
      console.log(chalk.gray(`Credentials saved to: ${envPath}\n`));
      console.log(chalk.cyan('🎉 You can now run:\n'));
      console.log(chalk.white('   cloudable docker'));
      console.log(chalk.white('   cloudable build my-app --remote'));
      console.log(chalk.white('   cloudable deploy my-app --remote\n'));

      if (this.rl) {
        this.rl.close();
      }

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Setup failed: ${error.message}\n`));
      if (this.rl) {
        this.rl.close();
      }
      throw error;
    }
  }

  /**
   * Prompt user for input
   */
  private prompt(question: string, hidden: boolean = false): Promise<string> {
    return new Promise((resolve) => {
      if (hidden) {
        // Hide input for secrets
        const stdin = process.stdin;
        const wasRaw = (stdin as any).isRaw;
        
        (stdin as any).setRawMode(true);
        stdin.resume();
        
        process.stdout.write(question);
        
        let input = '';
        
        const onData = (char: Buffer) => {
          const c = char.toString('utf8');
          
          switch (c) {
            case '\n':
            case '\r':
            case '\u0004': // Ctrl-D
              stdin.removeListener('data', onData);
              (stdin as any).setRawMode(wasRaw);
              stdin.pause();
              process.stdout.write('\n');
              resolve(input);
              break;
            case '\u0003': // Ctrl-C
              process.exit(0);
              break;
            case '\u007f': // Backspace
            case '\b':
              if (input.length > 0) {
                input = input.slice(0, -1);
                process.stdout.write('\b \b');
              }
              break;
            default:
              input += c;
              process.stdout.write('*');
              break;
          }
        };
        
        stdin.on('data', onData);
      } else {
        this.rl.question(question, (answer) => {
          resolve(answer.trim());
        });
      }
    });
  }

  /**
   * Validate AWS credentials
   */
  private async validateCredentials(
    accessKeyId: string,
    secretAccessKey: string,
    region: string
  ): Promise<boolean> {
    try {
      const stsClient = new STSClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      const identity = await stsClient.send(new GetCallerIdentityCommand({}));

      console.log(chalk.green('✅ Credentials valid!\n'));
      console.log(chalk.gray(`   AWS Account: ${identity.Account}`));
      console.log(chalk.gray(`   User ARN: ${identity.Arn}`));
      console.log(chalk.gray(`   Region: ${region}`));

      return true;
    } catch (error: any) {
      console.error(chalk.red(`   Error: ${error.message}`));
      return false;
    }
  }
}

