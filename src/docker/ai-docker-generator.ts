import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { DockerGenerationAgent } from '../ai/docker-agent.js';
import { FileAnalyzer } from '../ai/file-analyzer.js';

/**
 * AI-powered Docker configuration generator
 * Uses Mastra AI framework and OpenAI to intelligently generate Docker files
 */
export class AIDockerGenerator {
  private agent: DockerGenerationAgent;

  constructor() {
    try {
      this.agent = new DockerGenerationAgent();
    } catch (error: any) {
      if (error.message.includes('OPENAI_API_KEY')) {
        console.error(chalk.red('\n❌ OpenAI API key not found!'));
        console.log(chalk.yellow('\nPlease add your OpenAI API key to .env:'));
        console.log(chalk.gray('OPENAI_API_KEY=sk-your-key-here\n'));
      }
      throw error;
    }
  }

  /**
   * Main method: Generate all Docker configurations using AI
   */
  async generate(): Promise<void> {
    try {
      console.log(chalk.bold.cyan('\n🤖 AI-Powered Docker Configuration Generator\n'));
      console.log(chalk.gray('Using OpenAI via Mastra AI framework\n'));

      // PHASE 1: Directory Analysis
      const spinner1 = ora('Analyzing project structure...').start();
      const directoryTree = FileAnalyzer.getDirectoryTree('.', 4);
      spinner1.succeed(chalk.green('✅ Project structure analyzed'));

      console.log(chalk.gray(`\nDirectory tree (${directoryTree.split('\n').length} items):\n`));
      console.log(chalk.gray(directoryTree.split('\n').slice(0, 20).join('\n')));
      if (directoryTree.split('\n').length > 20) {
        console.log(chalk.gray('... (truncated for display)\n'));
      }

      // PHASE 2: AI File Discovery
      const spinner2 = ora('AI is analyzing which files to read...').start();
      const filesToRead = await this.agent.discoverFiles(directoryTree);
      spinner2.succeed(chalk.green(`✅ AI selected ${filesToRead.length} files to analyze`));

      console.log(chalk.cyan('\n📂 Files selected by AI:'));
      filesToRead.forEach(file => {
        console.log(chalk.gray(`   • ${file}`));
      });
      console.log();

      // PHASE 3: Read Selected Files
      const spinner3 = ora('Reading selected files...').start();
      const files = FileAnalyzer.readFiles(filesToRead);
      spinner3.succeed(chalk.green(`✅ Read ${files.length} files`));

      // PHASE 4: AI Configuration Generation
      const spinner4 = ora('AI is generating Docker configurations...').start();
      const configs = await this.agent.generateConfigurations(files);
      spinner4.succeed(chalk.green('✅ Docker configurations generated'));

      // PHASE 5: Write Files
      console.log(chalk.cyan('\n📝 Writing configuration files...\n'));
      
      fs.writeFileSync('Dockerfile', configs.dockerfile);
      console.log(chalk.green('   ✓ Dockerfile'));

      fs.writeFileSync('.dockerignore', configs.dockerignore);
      console.log(chalk.green('   ✓ .dockerignore'));

      if (configs.dockerCompose) {
        fs.writeFileSync('docker-compose.yml', configs.dockerCompose);
        console.log(chalk.green('   ✓ docker-compose.yml'));
      }

      // PHASE 6: Show Results
      console.log(chalk.bold.green('\n🎉 Success!\n'));

      if (configs.explanation) {
        console.log(chalk.cyan('💡 AI Explanation:\n'));
        console.log(chalk.gray(configs.explanation));
        console.log();
      }

      console.log(chalk.cyan('📄 Generated Dockerfile:\n'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(configs.dockerfile);
      console.log(chalk.gray('─'.repeat(50)));

      console.log(chalk.cyan('\n✨ Next steps:'));
      console.log(chalk.gray('   1. Review the generated Dockerfile'));
      console.log(chalk.gray('   2. Test: docker build -t myapp .'));
      console.log(chalk.gray('   3. Run: docker run -p 3000:3000 myapp\n'));

    } catch (error: any) {
      console.error(chalk.red('\n❌ Error generating Docker configurations:'));
      console.error(chalk.red(error.message));
      
      if (error.stack) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }

      throw error;
    }
  }

  /**
   * Check if Dockerfile already exists and ask user what to do
   */
  async shouldGenerate(): Promise<boolean> {
    if (fs.existsSync('Dockerfile')) {
      console.log(chalk.yellow('\n⚠️  Dockerfile already exists!'));
      
      // For now, just overwrite. In production, you'd ask the user.
      console.log(chalk.gray('Overwriting existing Dockerfile...\n'));
      return true;
    }
    return true;
  }
}

