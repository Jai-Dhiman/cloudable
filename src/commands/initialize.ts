import { Args, Command, Flags } from '@oclif/core';
import { resolve } from 'node:path';
import { basename } from 'node:path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import gradient from 'gradient-string';
import figlet from 'figlet';
import {
  orchestrateCloudableWorkflow,
  displayAnalysisResults,
  displayInfraRecommendations
} from '../orchestrator.js';

/**
 * Sanitize project name to be AWS-compatible
 * Must work with both ECR and CodeBuild naming requirements:
 * - ECR: ^(?:[a-z0-9]+(?:[._-][a-z0-9]+)*)$
 * - CodeBuild: Only alphanumeric, dash, and underscore
 * We use the stricter CodeBuild rules for compatibility with all AWS services
 */
function sanitizeAppName(name: string): string {
  return name
    .toLowerCase()                    // Convert to lowercase
    .replace(/[^a-z0-9_-]+/g, '-')   // Replace invalid chars (including periods) with hyphens
    .replace(/^[-_]+/, '')            // Remove leading separators
    .replace(/[-_]+$/, '')            // Remove trailing separators
    .replace(/[-_]{2,}/g, '-')        // Replace multiple separators with single hyphen
    .substring(0, 255);               // Limit to 255 chars
}

export default class Initialize extends Command {
  static description = 'Initialize and deploy your application to AWS with intelligent infrastructure recommendations';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> /path/to/project',
    '<%= config.bin %> <%= command.id %> --skip-questions',
    '<%= config.bin %> <%= command.id %> --app-name my-custom-app',
  ];

  static flags = {
    'skip-questions': Flags.boolean({
      description: 'Skip interactive questions and use default values',
      default: false
    }),
    'dry-run': Flags.boolean({
      description: 'Generate Terraform without deploying to AWS',
      default: false
    }),
    'app-name': Flags.string({
      description: 'Custom app name for AWS resources (must be lowercase alphanumeric with hyphens)',
      required: false
    })
  };

  static args = {
    path: Args.string({
      description: 'Path to the project directory',
      required: false,
      default: '.',
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Initialize);
    const projectPath = resolve(args.path);
    const projectName = basename(projectPath);
    
    // Use custom app name if provided, otherwise sanitize the project name
    const appName = flags['app-name'] || sanitizeAppName(projectName);
    
    // Validate the app name (using stricter CodeBuild rules for all AWS services)
    const awsNamePattern = /^[a-z0-9][a-z0-9_-]*$/;
    if (!awsNamePattern.test(appName)) {
      this.error(
        `Invalid app name: "${appName}"\n` +
        `App names must:\n` +
        `  - Start with a lowercase letter or number\n` +
        `  - Only contain lowercase letters, numbers, hyphens, and underscores\n` +
        `  - Not start or end with hyphens or underscores\n\n` +
        `Suggestion: Use --app-name flag with a valid name, e.g.:\n` +
        `  cloudable initialize --app-name ${sanitizeAppName(projectName)}`
      );
      return;
    }

    // Display welcome message with enhanced styling
    const banner = figlet.textSync('Cloudable', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default'
    });

    this.log('\n' + gradient.pastel.multiline(banner));
    
    const displayInfo = [
      chalk.white('Project: ') + chalk.cyan(projectName),
      chalk.white('App Name: ') + chalk.cyan(appName),
      chalk.white('Path: ') + chalk.gray(projectPath)
    ];
    
    // Show warning if name was sanitized
    if (appName !== projectName && !flags['app-name']) {
      displayInfo.push('');
      displayInfo.push(chalk.yellow('⚠️  Name sanitized for AWS compatibility'));
    }
    
    this.log(boxen(
      chalk.bold.cyan('Deploy to AWS in minutes') + '\n\n' +
      displayInfo.join('\n'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'cyan',
        align: 'center'
      }
    ));

    try {
      // STEP 1: Analyze codebase FIRST (before questions)
      this.log(chalk.cyan('Step 1: Analyzing your codebase...\n'));

      const codeAnalyzerSpinner = ora(chalk.cyan('AI agent analyzing code...')).start();
      const { CodeAnalyzerAgent } = await import('../agents/code-analyzer.js');
      const analyzer = new CodeAnalyzerAgent();

      const initialState = {
        projectId: '',
        projectPath,
        errors: []
      };

      const analysisResult = await analyzer.execute(initialState);
      codeAnalyzerSpinner.succeed(chalk.green('Code analysis complete'));

      if (!analysisResult.codeAnalysis) {
        this.error('Failed to analyze codebase');
        return;
      }

      // Show what we found in a box
      const foundItems = [
        chalk.cyan('Framework: ') + chalk.white(analysisResult.codeAnalysis.framework.framework)
      ];
      if (analysisResult.codeAnalysis.services.database) {
        foundItems.push(chalk.cyan('Database: ') + chalk.white(analysisResult.codeAnalysis.services.database.type));
      }
      if (analysisResult.codeAnalysis.services.cache) {
        foundItems.push(chalk.cyan('Cache: ') + chalk.white(analysisResult.codeAnalysis.services.cache.type));
      }

      this.log('\n' + boxen(
        chalk.bold('🔍 What we found:\n\n') + foundItems.join('\n'),
        {
          padding: { top: 0, bottom: 0, left: 2, right: 2 },
          borderStyle: 'round',
          borderColor: 'green'
        }
      ));

      // STEP 2: Ask ADAPTIVE questions based on what we found
      const userAnswers = flags['skip-questions']
        ? this.getDefaultAnswers()
        : await this.askAdaptiveQuestions(analysisResult.codeAnalysis);

      const configItems = [
        chalk.cyan('Cloud Provider: ') + chalk.white(userAnswers.cloudProvider.toUpperCase()),
        chalk.cyan('Expected DAU: ') + chalk.white(userAnswers.expectedDAU.toLocaleString()),
        chalk.cyan('Monthly Budget: ') + chalk.green(`$${userAnswers.budget}`),
        chalk.cyan('AWS Region: ') + chalk.white(userAnswers.awsRegion)
      ];
      if (userAnswers.customDomain) {
        configItems.push(chalk.cyan('Custom Domain: ') + chalk.white(userAnswers.customDomain));
      }

      this.log('\n' + boxen(
        chalk.bold('📋 Configuration Summary\n\n') + configItems.join('\n'),
        {
          padding: { top: 0, bottom: 0, left: 2, right: 2 },
          borderStyle: 'round',
          borderColor: 'blue'
        }
      ) + '\n');

      // STEP 3: Run infrastructure recommender with context
      this.log(chalk.cyan('Step 2: Generating infrastructure recommendations...\n'));

      const state = await orchestrateCloudableWorkflow({
        projectPath,
        userAnswers
      });

      // Display analysis results
      displayAnalysisResults(state);

      // Display infrastructure recommendations
      displayInfraRecommendations(state);

      // Check for critical errors
      if (state.errors.length > 0 && (!state.codeAnalysis || !state.infraRecommendation)) {
        this.log(chalk.red('\n✗ Critical errors occurred during analysis. Please review the errors above.\n'));
        return;
      }

      if (flags['dry-run']) {
        this.log(chalk.yellow('🔍 Dry run mode - Terraform files generated but not deployed\n'));
        this.log(chalk.gray('  Review the generated files in: ./terraform/\n'));
        return;
      }

      // Confirm deployment with enhanced prompt
      const estimatedCost = state.infraRecommendation?.recommended?.estimatedCost?.monthly || 0;
      const { confirmDeploy } = await inquirer.prompt<{ confirmDeploy: string }>([
        {
          type: 'list',
          name: 'confirmDeploy',
          message: `Ready to deploy. Estimated cost: ${chalk.green(`$${estimatedCost}/month`)}`,
          choices: [
            { name: 'Yes, deploy now', value: 'deploy' },
            { name: 'Save Terraform only (no deployment)', value: 'save' },
            { name: 'Cancel and exit', value: 'cancel' }
          ],
          default: 'deploy'
        }
      ]);

      if (confirmDeploy === 'cancel') {
        this.log('\n' + boxen(
          chalk.yellow('⚠️  Deployment cancelled\n\n') +
          chalk.gray('No changes were made to AWS'),
          {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
          }
        ) + '\n');
        return;
      }

      if (confirmDeploy === 'save') {
        this.log('\n' + boxen(
          chalk.blue('💾 Terraform files saved\n\n') +
          chalk.gray('Review files in: ./terraform/\n') +
          chalk.gray('Deploy later with: terraform apply'),
          {
            padding: 1,
            borderStyle: 'round',
            borderColor: 'blue'
          }
        ) + '\n');
        return;
      }

      // Phase 4: AWS Setup & Deployment Pipeline
      this.log(chalk.cyan('\nStep 3: Setting up AWS credentials & deployment...\n'));

      // Step 4a: AWS Credentials Setup
      this.log(chalk.bold('🔐 Setting up AWS credentials...\n'));
      
      // Prompt for AWS credentials using inquirer
      const awsCredentials = await inquirer.prompt([
        {
          type: 'input',
          name: 'accessKeyId',
          message: 'AWS Access Key ID:',
          validate: (input: string) => input.length > 0 || 'Access Key ID cannot be empty',
        },
        {
          type: 'password',
          name: 'secretAccessKey',
          message: 'AWS Secret Access Key:',
          mask: '*',
          validate: (input: string) => input.length > 0 || 'Secret Access Key cannot be empty',
        },
        {
          type: 'input',
          name: 'region',
          message: 'AWS Region:',
          default: userAnswers.awsRegion || 'us-east-1',
        },
      ]);

      const Setup = (await import('./setup.js')).default;
      const setupCmd = new Setup(
        ['--access-key', awsCredentials.accessKeyId, '--secret-key', awsCredentials.secretAccessKey, '--region', awsCredentials.region],
        this.config
      );
      await setupCmd.run();

      // Step 4b: Generate Dockerfile with AI
      this.log(chalk.bold('\n🐳 Generating Dockerfile with AI...\n'));
      const Docker = (await import('./docker.js')).default;
      const dockerCmd = new Docker(this.argv, this.config);
      await dockerCmd.run();

      // Step 4c: Setup Remote Build (AWS CodeBuild)
      this.log(chalk.bold('\n☁️  Setting up AWS remote build...\n'));
      const SetupRemote = (await import('./setup-remote.js')).default;
      const setupRemoteCmd = new SetupRemote(this.argv, this.config);
      await setupRemoteCmd.run();

      // Step 4d: Deploy to AWS
      const deploySpinner = ora(chalk.cyan('Deploying to AWS EC2...')).start();
      
      const Deploy = (await import('./deploy.js')).default;
      const deployCmd = new Deploy(
        [appName, '--remote'],
        this.config
      );
      
      try {
        await deployCmd.run();
        deploySpinner.succeed(chalk.green('Deployment complete'));
      } catch (error: any) {
        deploySpinner.fail(chalk.red('Deployment failed'));
        throw error;
      }

      // Success message with enhanced formatting
      this.log('\n' + boxen(
        chalk.bold.green('✓ Deployment Successful!\n\n') +
        chalk.bold('🌐 Your application is live at:\n') +
        chalk.cyan.underline('https://ec2-xx-xxx-xxx-xx.compute-1.amazonaws.com\n\n') +
        chalk.bold('📊 Cost Monitoring:\n') +
        chalk.gray('• Weekly cost reports via email\n') +
        chalk.gray('• Reply to control resources\n') +
        chalk.gray('  (e.g., "stop this service")\n\n') +
        chalk.bold('📁 Next Steps:\n') +
        chalk.gray('• View infrastructure: ') + chalk.cyan('cd terraform && terraform show\n') +
        chalk.gray('• AWS Console: ') + chalk.cyan('https://console.aws.amazon.com\n') +
        chalk.gray('• Destroy resources: ') + chalk.cyan('cloudable destroy'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green'
        }
      ) + '\n');

    } catch (error) {
      this.error(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async askAdaptiveQuestions(codeAnalysis: any) {
    this.log(chalk.bold('📝 A few questions to optimize your deployment:\n'));

    const questions: any[] = [];

    // Question 1: Expected DAU (always ask)
    questions.push({
      type: 'input',
      name: 'expectedDAU',
      message: `Expected daily active users for your ${codeAnalysis.framework.framework} app?`,
      default: '100',
      validate: (input: string) => {
        const num = parseInt(input, 10);
        if (isNaN(num) || num <= 0) return 'DAU must be a positive number';
        return true;
      }
    });

    // Question 2: Budget (always ask)
    questions.push({
      type: 'input',
      name: 'budget',
      message: 'Monthly infrastructure budget (USD)?',
      default: '50',
      validate: (input: string) => {
        const num = parseInt(input, 10);
        if (isNaN(num) || num <= 0) return 'Budget must be a positive number';
        return true;
      }
    });

    // Question 3: Database preference (only if database detected)
    if (codeAnalysis.services.database) {
      questions.push({
        type: 'list',
        name: 'databasePreference',
        message: `We detected ${codeAnalysis.services.database.type}. How do you want to host it?`,
        choices: [
          `Managed RDS ${codeAnalysis.services.database.type} (recommended - automatic backups, scaling)`,
          `Self-hosted on EC2 (lower cost, more control)`
        ],
        default: `Managed RDS ${codeAnalysis.services.database.type} (recommended - automatic backups, scaling)`
      });
    }

    // Question 4: AWS Region (always ask)
    questions.push({
      type: 'list',
      name: 'awsRegion',
      message: 'Preferred AWS region (choose closest to your users)?',
      choices: [
        'us-east-1 (US East - N. Virginia)',
        'us-west-2 (US West - Oregon)',
        'eu-west-1 (EU - Ireland)',
        'ap-northeast-1 (Asia Pacific - Tokyo)',
        'ap-southeast-1 (Asia Pacific - Singapore)'
      ],
      default: 'us-east-1 (US East - N. Virginia)'
    });

    // Question 5: Custom domain (optional)
    questions.push({
      type: 'input',
      name: 'customDomain',
      message: 'Custom domain (optional, leave blank to skip)?',
      default: ''
    });

    const answers: any = await inquirer.prompt(questions);

    return {
      cloudProvider: 'aws',
      expectedDAU: parseInt(answers.expectedDAU, 10),
      budget: parseInt(answers.budget, 10),
      databasePreference: answers.databasePreference ?
        (answers.databasePreference.includes('Managed RDS') ? 'managed' : 'self-hosted') :
        undefined,
      customDomain: answers.customDomain || undefined,
      awsRegion: answers.awsRegion.split(' ')[0]
    };
  }

  private getDefaultAnswers() {
    return {
      cloudProvider: 'aws',
      expectedDAU: 100,
      budget: 50,
      customDomain: undefined,
      awsRegion: 'us-east-1'
    };
  }
}
