import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import type { TerraformConfig, GeneratedFiles } from '../types/terraform.types.js';
import * as ec2Template from './templates/aws-ec2.template.js';

export class TerraformGenerator {
  private terraformDir: string;

  constructor(terraformDir: string = './terraform') {
    this.terraformDir = terraformDir;
  }

  /**
   * Generate all Terraform configuration files
   */
  async generate(config: TerraformConfig): Promise<void> {
    const spinner = ora('Generating Terraform configuration files...').start();

    try {
      // Create terraform directory
      if (!fs.existsSync(this.terraformDir)) {
        fs.mkdirSync(this.terraformDir, { recursive: true });
      }

      // Generate files based on provider and service
      const files = this.selectTemplate(config);

      // Write main.tf
      fs.writeFileSync(
        path.join(this.terraformDir, 'main.tf'),
        files.mainTf.trim() + '\n',
        'utf-8'
      );

      // Write variables.tf
      fs.writeFileSync(
        path.join(this.terraformDir, 'variables.tf'),
        files.variablesTf.trim() + '\n',
        'utf-8'
      );

      // Write outputs.tf
      fs.writeFileSync(
        path.join(this.terraformDir, 'outputs.tf'),
        files.outputsTf.trim() + '\n',
        'utf-8'
      );

      // Write any additional files
      if (files.additionalFiles) {
        for (const [filename, content] of Object.entries(files.additionalFiles)) {
          fs.writeFileSync(
            path.join(this.terraformDir, filename),
            content.trim() + '\n',
            'utf-8'
          );
        }
      }

      spinner.succeed(chalk.green('✅ Terraform files generated'));
      console.log(chalk.gray(`\n   Generated files in ${this.terraformDir}:`));
      console.log(chalk.gray('   • main.tf'));
      console.log(chalk.gray('   • variables.tf'));
      console.log(chalk.gray('   • outputs.tf\n'));
    } catch (error: any) {
      spinner.fail(chalk.red('❌ Failed to generate Terraform files'));
      throw error;
    }
  }

  /**
   * Select appropriate template based on config
   */
  private selectTemplate(config: TerraformConfig): GeneratedFiles {
    if (config.provider === 'aws') {
      // Only EC2 is supported
      return {
        mainTf: ec2Template.generateEC2Terraform(config),
        variablesTf: ec2Template.generateEC2Variables(config),
        outputsTf: ec2Template.generateEC2Outputs(config)
      };
    } else if (config.provider === 'gcp') {
      throw new Error('GCP support coming soon');
    } else if (config.provider === 'azure') {
      throw new Error('Azure support coming soon');
    } else {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}

