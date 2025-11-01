import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class EnvManager {
  private static ENV_FILE_PATH = path.join(process.cwd(), '.env');
  private static ENV_EXAMPLE_PATH = path.join(process.cwd(), '.env.example');

  /**
   * Check if .env file exists
   */
  static envFileExists(): boolean {
    return fs.existsSync(this.ENV_FILE_PATH);
  }

  /**
   * Read credentials from .env file
   */
  static readCredentials(): {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
  } | null {
    try {
      if (!this.envFileExists()) {
        return null;
      }

      const envContent = fs.readFileSync(this.ENV_FILE_PATH, 'utf-8');
      const lines = envContent.split('\n');

      let accessKeyId: string | undefined;
      let secretAccessKey: string | undefined;
      let region: string | undefined;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        if (trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim(); // Handle values with = in them

          if (key.trim() === 'AWS_ACCESS_KEY_ID') {
            accessKeyId = value;
          } else if (key.trim() === 'AWS_SECRET_ACCESS_KEY') {
            secretAccessKey = value;
          } else if (key.trim() === 'AWS_DEFAULT_REGION' || key.trim() === 'AWS_REGION') {
            region = value;
          }
        }
      }

      if (accessKeyId && secretAccessKey && region) {
        return { accessKeyId, secretAccessKey, region };
      }

      return null;
    } catch (error) {
      console.error(chalk.red('Error reading .env file:'), error);
      return null;
    }
  }

  /**
   * Write credentials to .env file
   */
  static writeCredentials(accessKeyId: string, secretAccessKey: string, region: string): void {
    try {
      let envContent = '';

      // If .env exists, read it and preserve non-AWS variables
      if (this.envFileExists()) {
        const existingContent = fs.readFileSync(this.ENV_FILE_PATH, 'utf-8');
        const lines = existingContent.split('\n');

        // Filter out existing AWS credentials
        const filteredLines = lines.filter(line => {
          const trimmed = line.trim();
          return !(
            trimmed.startsWith('AWS_ACCESS_KEY_ID=') ||
            trimmed.startsWith('AWS_SECRET_ACCESS_KEY=') ||
            trimmed.startsWith('AWS_DEFAULT_REGION=') ||
            trimmed.startsWith('AWS_REGION=')
          );
        });

        envContent = filteredLines.join('\n');
        
        // Remove trailing newlines
        envContent = envContent.replace(/\n+$/, '');
        
        // Add single newline if content exists
        if (envContent.length > 0) {
          envContent += '\n\n';
        }
      }

      // Add AWS credentials
      envContent += '# AWS Credentials\n';
      envContent += `AWS_ACCESS_KEY_ID=${accessKeyId}\n`;
      envContent += `AWS_SECRET_ACCESS_KEY=${secretAccessKey}\n`;
      envContent += `AWS_DEFAULT_REGION=${region}\n`;
      envContent += `AWS_REGION=${region}\n`;

      // Write to .env file
      fs.writeFileSync(this.ENV_FILE_PATH, envContent, 'utf-8');

      console.log(chalk.green(`✅ Credentials saved to .env file`));
      
      // Ensure .env is in .gitignore
      this.ensureGitignore();

    } catch (error) {
      console.error(chalk.red('Error writing .env file:'), error);
      throw error;
    }
  }

  /**
   * Create .env.example template file
   */
  static createEnvExample(): void {
    const exampleContent = `# AWS Credentials
# Get these from: https://console.aws.amazon.com/iam/home#/security_credentials

AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_DEFAULT_REGION=us-east-1
AWS_REGION=us-east-1
`;

    if (!fs.existsSync(this.ENV_EXAMPLE_PATH)) {
      fs.writeFileSync(this.ENV_EXAMPLE_PATH, exampleContent, 'utf-8');
      console.log(chalk.gray('Created .env.example file'));
    }
  }

  /**
   * Ensure .env is in .gitignore
   */
  private static ensureGitignore(): void {
    const gitignorePath = path.join(process.cwd(), '.gitignore');

    try {
      let gitignoreContent = '';

      // Read existing .gitignore if it exists
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      }

      // Check if .env is already in .gitignore
      if (!gitignoreContent.includes('.env')) {
        gitignoreContent += '\n# Environment variables\n.env\n';
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
        console.log(chalk.gray('✅ Added .env to .gitignore'));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not update .gitignore. Make sure to add .env manually!'));
    }
  }

  /**
   * Load .env file into process.env
   */
  static loadEnvFile(): void {
    if (this.envFileExists()) {
      import('dotenv').then(dotenv => {
        dotenv.config({ path: this.ENV_FILE_PATH });
      });
    }
  }

  /**
   * Delete .env file (for testing or reset purposes)
   */
  static deleteEnvFile(): void {
    if (this.envFileExists()) {
      fs.unlinkSync(this.ENV_FILE_PATH);
      console.log(chalk.yellow('🗑️  Deleted .env file'));
    }
  }
}

