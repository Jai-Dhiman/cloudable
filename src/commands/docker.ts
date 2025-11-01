import { Command } from '@oclif/core';
import { AIDockerGenerator } from '../docker/ai-docker-generator.js';
import chalk from 'chalk';

export default class Docker extends Command {
  static description = 'Generate Docker configurations using AI';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    try {
      console.log(chalk.bold.cyan('\n🐳 Cloudable AI Docker Generator\n'));

      const generator = new AIDockerGenerator();
      await generator.generate();

    } catch (error: any) {
      this.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }
}

