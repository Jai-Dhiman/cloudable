import chalk from 'chalk';
import type { TerraformOutputs } from '../types/terraform.types.js';

export class TerraformOutputParser {
  /**
   * Display deployment results in a beautiful format
   */
  static displayResults(outputs: TerraformOutputs): void {
    // Handle both camelCase and snake_case keys from Terraform
    const appUrl = outputs.appUrl || outputs.app_url || (outputs as any)['app_url'];
    const loadBalancerUrl = outputs.loadBalancerUrl || (outputs as any)['load_balancer_dns'];
    const region = outputs.region;
    
    console.log(chalk.bold.green('\n\n🎉 Deployment Successful!\n'));
    console.log(chalk.cyan('═'.repeat(60)));

    // Main application URL (most important)
    console.log(chalk.bold.green('\n📍 Your Application URL:\n'));
    console.log(chalk.bold.white(`   ${appUrl}\n`));
    console.log(chalk.cyan('═'.repeat(60)));

    // Additional information
    console.log(chalk.bold('\n📦 Deployment Details:\n'));

    if (loadBalancerUrl) {
      console.log(chalk.gray(`   Load Balancer: ${loadBalancerUrl}`));
    }

    if (region) {
      console.log(chalk.gray(`   Region: ${region}`));
    }

    if (outputs.databaseEndpoint || (outputs as any)['database_endpoint']) {
      console.log(chalk.gray(`   Database: ${outputs.databaseEndpoint || (outputs as any)['database_endpoint']}`));
    }

    // Show any other outputs
    const displayedKeys = ['appUrl', 'app_url', 'loadBalancerUrl', 'load_balancer_dns', 'region', 'databaseEndpoint', 'database_endpoint'];
    const otherOutputs = Object.entries(outputs).filter(
      ([key]) => !displayedKeys.includes(key)
    );

    if (otherOutputs.length > 0) {
      console.log(chalk.gray('\n   Additional Resources:'));
      otherOutputs.forEach(([key, value]) => {
        console.log(chalk.gray(`   • ${key}: ${value}`));
      });
    }

    console.log(chalk.cyan('\n═'.repeat(60)));

    // Next steps
    console.log(chalk.bold('\n✨ Next Steps:\n'));
    console.log(chalk.gray('   1. Visit your application URL above'));
    console.log(chalk.gray('   2. Monitor logs and performance'));
    console.log(chalk.gray('   3. Set up custom domain (optional)'));
    console.log(chalk.gray('   4. Configure SSL certificate (optional)\n'));
  }

  /**
   * Extract just the URL for programmatic use
   */
  static getUrl(outputs: TerraformOutputs): string {
    return outputs.appUrl || outputs.app_url || (outputs as any)['app_url'];
  }

  /**
   * Validate that required outputs exist
   */
  static validate(outputs: TerraformOutputs): boolean {
    // Terraform returns keys with underscores (app_url) but we map them to camelCase
    const appUrl = outputs.appUrl || outputs.app_url || (outputs as any)['app_url'];
    
    if (!appUrl) {
      console.error(chalk.red('\n❌ Error: Terraform did not return an application URL'));
      console.error(chalk.gray('\nReceived outputs:', JSON.stringify(outputs, null, 2)));
      return false;
    }

    return true;
  }
}

