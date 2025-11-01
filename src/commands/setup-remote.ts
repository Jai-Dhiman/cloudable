import { Command } from '@oclif/core';
import { IAMClient, CreateRoleCommand, AttachRolePolicyCommand, GetRoleCommand } from '@aws-sdk/client-iam';
import chalk from 'chalk';
import ora from 'ora';

export default class SetupRemote extends Command {
  static description = 'Setup AWS IAM role for remote Docker builds';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
  ];

  public async run(): Promise<void> {
    try {
      console.log(chalk.bold.cyan('\n🔧 AWS Remote Build Setup\n'));
      console.log(chalk.gray('This will create the IAM role needed for AWS CodeBuild remote builds\n'));

      const iamClient = new IAMClient({});
      const roleName = 'CloudableCodeBuildRole';

      // Check if role already exists
      try {
        await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
        console.log(chalk.green(`✅ Role '${roleName}' already exists\n`));
        console.log(chalk.cyan('You\'re all set! Run:'));
        console.log(chalk.white('  cloudable build my-app --remote\n'));
        return;
      } catch (error: any) {
        // Role doesn't exist, continue to create it
        if (error.name !== 'NoSuchEntity' && error.name !== 'NoSuchEntityException') {
          // Some other error occurred
          console.log(chalk.yellow(`Note: ${error.message}`));
        }
        // Continue to create the role
      }

      // Create role
      const spinner = ora('Creating IAM role...').start();

      const trustPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: {
            Service: 'codebuild.amazonaws.com'
          },
          Action: 'sts:AssumeRole'
        }]
      };

      await iamClient.send(new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
        Description: 'Role for Cloudable remote Docker builds',
      }));

      spinner.text = 'Attaching policies...';

      // Attach required policies
      const policies = [
        'arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser',
        'arn:aws:iam::aws:policy/AmazonS3FullAccess',
        'arn:aws:iam::aws:policy/CloudWatchLogsFullAccess',
      ];

      for (const policyArn of policies) {
        await iamClient.send(new AttachRolePolicyCommand({
          RoleName: roleName,
          PolicyArn: policyArn,
        }));
      }

      spinner.succeed(chalk.green('✅ IAM role created successfully'));

      // Wait a few seconds for IAM to propagate
      console.log(chalk.gray('\nWaiting for IAM role to propagate...'));
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(chalk.bold.green('\n🎉 Setup Complete!\n'));
      console.log(chalk.cyan('You can now use remote builds:'));
      console.log(chalk.white('  cloudable build my-app --remote\n'));
      console.log(chalk.gray('Benefits:'));
      console.log(chalk.gray('  • No Docker Desktop needed'));
      console.log(chalk.gray('  • Builds happen in AWS'));
      console.log(chalk.gray('  • Faster on large projects\n'));

    } catch (error: any) {
      this.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
  }
}

