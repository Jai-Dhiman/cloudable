import { AIDockerGenerator } from './ai-docker-generator.js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

async function testAIDockerGenerator() {
  try {
    // Load environment variables
    dotenv.config();

    console.log(chalk.bold.cyan('🧪 Testing AI Docker Generator\n'));

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error(chalk.red('❌ OPENAI_API_KEY not found in .env file'));
      console.log(chalk.yellow('\nPlease create a .env file with:'));
      console.log(chalk.gray('OPENAI_API_KEY=sk-your-key-here\n'));
      process.exit(1);
    }

    console.log(chalk.green('✅ OpenAI API key found\n'));

    // Create generator and run
    const generator = new AIDockerGenerator();
    await generator.generate();

    console.log(chalk.bold.green('\n✅ Test completed successfully!\n'));

  } catch (error: any) {
    console.error(chalk.red('\n❌ Test failed:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

// Run the test
testAIDockerGenerator();

