import { TerraformGenerator } from './terraform-generator.js';
import { TerraformRunner } from './terraform-runner.js';
import { TerraformOutputParser } from './terraform-output-parser.js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

async function testTerraformDeployment() {
  try {
    dotenv.config();

    console.log(chalk.bold.cyan('🧪 Testing Terraform Deployment\n'));

    // Simulate having a Docker image URI from previous step
    const mockImageUri = '123456789.dkr.ecr.us-east-1.amazonaws.com/myapp:latest';

    // STEP 1: Generate Terraform files
    const generator = new TerraformGenerator('./terraform');
    
    await generator.generate({
      provider: 'aws',
      service: 'ec2',
      appName: 'test-app',
      region: 'us-east-1',
      imageUri: mockImageUri
    });

    // STEP 2: Initialize Terraform
    const runner = new TerraformRunner('./terraform');
    await runner.init();

    // STEP 3: Plan (optional, good for verification)
    await runner.plan();

    // STEP 4: Apply (deploy)
    await runner.apply();

    // STEP 5: Get outputs
    const outputs = await runner.getOutputs() as any;

    // STEP 6: Validate and display
    if (TerraformOutputParser.validate(outputs)) {
      TerraformOutputParser.displayResults(outputs);
      
      // Extract URL for programmatic use
      const url = TerraformOutputParser.getUrl(outputs);
      console.log(chalk.bold.cyan(`\n🔗 Application URL: ${url}\n`));
    }

    console.log(chalk.bold.green('✅ Test completed successfully!\n'));

  } catch (error: any) {
    console.error(chalk.red('\n❌ Test failed:'));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

testTerraformDeployment();

