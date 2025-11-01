import { spawn, execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

export class TerraformRunner {
  private terraformDir: string;

  constructor(terraformDir: string = './terraform') {
    this.terraformDir = terraformDir;
  }

  /**
   * Check if Terraform is installed
   */
  private async checkTerraformInstalled(): Promise<boolean> {
    try {
      execSync('terraform version', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Accept Xcode license if needed
   */
  private acceptXcodeLicense(): void {
    console.log(chalk.yellow('\n⚠️  Xcode license needs to be accepted'));
    console.log(chalk.cyan('📋 Accepting Xcode license (you may need to enter your password)...\n'));
    
    try {
      execSync('sudo xcodebuild -license accept', { stdio: 'inherit' });
      console.log(chalk.green('\n✅ Xcode license accepted\n'));
    } catch (error: any) {
      console.log(chalk.red('\n❌ Failed to accept Xcode license'));
      console.log(chalk.yellow('\n💡 Please run this command manually:'));
      console.log(chalk.gray('   sudo xcodebuild -license accept\n'));
      throw error;
    }
  }

  /**
   * Install Terraform using Homebrew (macOS/Linux)
   */
  private async installTerraform(): Promise<void> {
    console.log(chalk.yellow('\n⚠️  Terraform is not installed'));
    console.log(chalk.cyan('📦 Installing Terraform automatically...\n'));

    try {
      // Check if Homebrew is installed
      try {
        execSync('brew --version', { stdio: 'ignore' });
        console.log(chalk.green('✅ Homebrew detected\n'));
      } catch (error) {
        console.log(chalk.red('❌ Homebrew is not installed'));
        console.log(chalk.yellow('\n💡 Please install Homebrew first:'));
        console.log(chalk.gray('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\n'));
        throw new Error('Homebrew is required to auto-install Terraform');
      }

      // Add Hashicorp tap
      console.log(chalk.cyan('Adding Hashicorp tap...'));
      try {
        execSync('brew tap hashicorp/tap', { stdio: 'pipe' });
      } catch (error: any) {
        const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message || '';
        
        // Check if it's an Xcode license error
        if (errorOutput.includes('Xcode license') || errorOutput.includes('xcodebuild')) {
          this.acceptXcodeLicense();
          // Retry after accepting license
          try {
            execSync('brew tap hashicorp/tap', { stdio: 'inherit' });
          } catch (retryError) {
            console.log(chalk.yellow('\n⚠️  Tap may already exist, continuing...\n'));
          }
        } else {
          console.log(chalk.yellow('\n⚠️  Tap may already exist, continuing...\n'));
        }
      }

      // Install Terraform (show all output so user can see progress)
      console.log(chalk.cyan('\nInstalling Terraform (this may take a minute)...'));
      try {
        execSync('brew install hashicorp/tap/terraform', { stdio: 'inherit' });
      } catch (error: any) {
        const errorOutput = error.stderr?.toString() || error.stdout?.toString() || error.message || '';
        
        // Check if it's an Xcode license error
        if (errorOutput.includes('Xcode license') || errorOutput.includes('xcodebuild')) {
          this.acceptXcodeLicense();
          // Retry installation after accepting license
          console.log(chalk.cyan('\nRetrying Terraform installation...\n'));
          execSync('brew install hashicorp/tap/terraform', { stdio: 'inherit' });
        } else {
          throw error;
        }
      }

      console.log(chalk.green('\n✅ Terraform installed successfully\n'));

      // Verify installation
      const version = execSync('terraform version', { encoding: 'utf-8' });
      console.log(chalk.gray(`   ${version.split('\n')[0]}\n`));
    } catch (error: any) {
      console.log(chalk.red('\n❌ Failed to install Terraform'));
      console.log(chalk.yellow('\n💡 Error details:', error.message));
      console.log(chalk.yellow('\n💡 Please try installing Terraform manually:'));
      console.log(chalk.gray('   brew install terraform\n'));
      console.log(chalk.gray('Or download from: https://www.terraform.io/downloads\n'));
      throw new Error('Failed to install Terraform automatically');
    }
  }

  /**
   * Initialize Terraform
   */
  async init(): Promise<void> {
    // Check if Terraform is installed, install if not
    const isInstalled = await this.checkTerraformInstalled();
    if (!isInstalled) {
      await this.installTerraform();
    }

    const spinner = ora('Initializing Terraform...').start();

    try {
      await this.runCommand('terraform', ['init'], false);
      spinner.succeed(chalk.green('✅ Terraform initialized'));
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Terraform init failed'));
      throw error;
    }
  }

  /**
   * Run terraform plan
   */
  async plan(): Promise<void> {
    const spinner = ora('Creating Terraform plan...').start();

    try {
      await this.runCommand('terraform', ['plan'], false);
      spinner.succeed(chalk.green('✅ Terraform plan created'));
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Terraform plan failed'));
      throw error;
    }
  }

  /**
   * Run terraform apply
   */
  async apply(): Promise<void> {
    console.log(chalk.cyan('\n🚀 Deploying infrastructure to cloud...\n'));
    console.log(chalk.gray('This may take 5-15 minutes depending on the service...\n'));

    const spinner = ora('Running terraform apply...').start();

    try {
      await this.runCommand('terraform', ['apply', '-auto-approve'], true);
      spinner.succeed(chalk.green('✅ Infrastructure deployed successfully!'));
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Terraform apply failed'));
      throw error;
    }
  }

  /**
   * Get Terraform outputs as JSON
   */
  async getOutputs(): Promise<Record<string, any>> {
    const spinner = ora('Retrieving deployment information...').start();

    try {
      const output = await this.runCommandWithOutput('terraform', ['output', '-json']);
      const outputs = JSON.parse(output);

      spinner.succeed(chalk.green('✅ Retrieved deployment information'));

      // Transform Terraform output format to simple key-value pairs
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(outputs)) {
        result[key] = (value as any).value;
      }

      return result;
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Failed to retrieve outputs'));
      throw error;
    }
  }

  /**
   * Run terraform destroy (for cleanup)
   */
  async destroy(): Promise<void> {
    const spinner = ora('Destroying infrastructure...').start();

    try {
      await this.runCommand('terraform', ['destroy', '-auto-approve'], true);
      spinner.succeed(chalk.green('✅ Infrastructure destroyed'));
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Terraform destroy failed'));
      throw error;
    }
  }

  /**
   * Run a Terraform command
   */
  private runCommand(
    command: string,
    args: string[],
    showOutput: boolean = false
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd: this.terraformDir,
        stdio: showOutput ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          TF_IN_AUTOMATION: 'true'
        }
      });

      let stderr = '';

      if (!showOutput) {
        childProcess.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} exited with code ${code}${stderr ? ': ' + stderr : ''}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Run a command and capture output
   */
  private runCommandWithOutput(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd: this.terraformDir,
        env: {
          ...process.env,
          TF_IN_AUTOMATION: 'true'
        }
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`${command} exited with code ${code}: ${stderr}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
}

