import { Command } from '@oclif/core';
import { AIDockerGenerator } from '../docker/ai-docker-generator.js';
import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';

export default class Docker extends Command {
  static description = 'Generate Docker configurations using AI';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    try {
      const dockerBanner = figlet.textSync('Docker', {
        font: 'Standard',
        horizontalLayout: 'default'
      });

      console.log('\n' + gradient.cristal.multiline(dockerBanner));
      console.log(boxen(
        chalk.bold.cyan('AI-Powered Docker Configuration\n\n') +
        chalk.gray('Automatically generate optimized Docker configs for your project'),
        {
          padding: 1,
          margin: { top: 1, bottom: 1, left: 2, right: 2 },
          borderStyle: 'round',
          borderColor: 'blue',
          align: 'center'
        }
      ));

      const generator = new AIDockerGenerator();
      await generator.generate();

    } catch (error: any) {
      console.log('\n' + boxen(
        chalk.red.bold('❌ Docker Generation Failed\n\n') +
        chalk.white(error.message),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'red'
        }
      ) + '\n');
      this.error('Docker generation encountered an error');
    }
  }
}

