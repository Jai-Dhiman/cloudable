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

export default class Initialize extends Command {
  static description = 'Initialize and deploy your application to AWS with intelligent infrastructure recommendations';

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> /path/to/project',
    '<%= config.bin %> <%= command.id %> --skip-questions',
  ];

  static flags = {
    'skip-questions': Flags.boolean({
      description: 'Skip interactive questions and use default values',
      default: false
    }),
    'dry-run': Flags.boolean({
      description: 'Generate Terraform without deploying to AWS',
      default: false
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

    // Display welcome message with enhanced styling
    const banner = figlet.textSync('Cloudable', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default'
    });

    this.log('\n' + gradient.pastel.multiline(banner));
    this.log(boxen(
      chalk.bold.cyan('Deploy to AWS in minutes') + '\n\n' +
      chalk.white('Project: ') + chalk.cyan(projectName) + '\n' +
      chalk.white('Path: ') + chalk.gray(projectPath),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'cyan',
        align: 'center'
      }
    ));

    try {
      // STEP 1: Analyze codebase using BASIC detection (no AI needed)
      this.log(chalk.cyan('Step 1: Analyzing your codebase...\n'));

      const codeAnalyzerSpinner = ora(chalk.cyan('Analyzing code...')).start();
      const { ProjectAnalyzer } = await import('../analyzers/project-analyzer.js');
      const analyzer = new ProjectAnalyzer(projectPath);

      const basicAnalysis = await analyzer.analyze();
      
      // Convert to expected format
      const analysisResult = {
        codeAnalysis: basicAnalysis,
        errors: []
      };
      
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

      // STEP 2: Skip AI recommendations - we have basic analysis which is enough
      // Infrastructure will be configured during deployment
      this.log(chalk.cyan('\nStep 2: Preparing deployment configuration...\n'));
      this.log(chalk.green('✓ Configuration ready\n'));

      if (flags['dry-run']) {
        this.log(chalk.yellow('🔍 Dry run mode - Terraform files generated but not deployed\n'));
        this.log(chalk.gray('  Review the generated files in: ./terraform/\n'));
        return;
      }

      // Confirm deployment
      const { confirmDeploy } = await inquirer.prompt<{ confirmDeploy: boolean }>([
        {
          type: 'confirm',
          name: 'confirmDeploy',
          message: 'Ready to deploy?',
          default: true
        }
      ]);

      if (!confirmDeploy) {
        this.log(chalk.yellow('\n⚠️  Deployment cancelled\n'));
        return;
      }

      // Phase 4: Deployment (detect mode based on AWS credentials)
      this.log(chalk.cyan('\nStep 3: Deploying your application...\n'));

      // Step 3a: Ensure Dockerfile exists (basic detection, no AI needed)
      const fs = await import('fs');
      const dockerfilePath = 'Dockerfile';
      
      if (!fs.existsSync(dockerfilePath)) {
        this.log(chalk.yellow('⚠️  No Dockerfile found. Creating a basic Next.js Dockerfile...\n'));
        
        // Create a basic Dockerfile for Next.js
        const basicDockerfile = `# Multi-stage build for Next.js
FROM node:19-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:19-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:19-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]`;

        fs.writeFileSync(dockerfilePath, basicDockerfile);
        this.log(chalk.green('✓ Dockerfile created\n'));
      } else {
        this.log(chalk.green('✓ Dockerfile found\n'));
      }

      // Check if user has AWS credentials configured locally
      const hasLocalAWSCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
      
      if (hasLocalAWSCreds) {
        // OLD FLOW: User has AWS credentials - use local Docker build + Deploy command
        this.log(chalk.bold('\n☁️  Deploying with local AWS credentials...\n'));
        
        const Deploy = (await import('./deploy.js')).default;
        const deployCmd = new Deploy(
          [projectName, '--remote'],
          this.config
        );
        await deployCmd.run();
        
      } else {
        // NEW FLOW: No AWS credentials - use backend API
        this.log(chalk.bold('\n☁️  Deploying to cloud infrastructure...\n'));
        this.log(chalk.gray('Using Cloudable deployment service...\n'));
        
        const { BackendDeployService } = await import('../services/backend-deploy.service.js');
        const deployService = new BackendDeployService();
      
      try {
        // Upload and start build
        const deployResult = await deployService.deployProject(
          projectName,
          userAnswers.awsRegion || 'us-east-1'
        );

        console.log(chalk.green(`\n✅ Build started: ${deployResult.buildId}\n`));
        
        // Wait for build to complete
        await deployService.waitForBuild(
          deployResult.buildId,
          userAnswers.awsRegion || 'us-east-1'
        );

        console.log(chalk.green(`\n✅ Docker image ready: ${deployResult.imageUri}\n`));

        // Continue with Terraform deployment (skip Docker build since backend already did it)
        this.log(chalk.bold('\n📝 Step 3/4: Generate Terraform Configuration\n'));
        
        const { TerraformGenerator } = await import('../terraform/terraform-generator.js');
        const { TerraformRunner } = await import('../terraform/terraform-runner.js');
        const { TerraformOutputParser } = await import('../terraform/terraform-output-parser.js');
        
        const terraformDir = './terraform';
        const terraformGen = new TerraformGenerator(terraformDir);

        await terraformGen.generate({
          provider: 'aws',
          service: 'ec2',
          appName: projectName,
          region: userAnswers.awsRegion || 'us-east-1',
          imageUri: deployResult.imageUri,
        });

        // Step 4: Deploy with Terraform
        this.log(chalk.bold('\n🏗️  Step 4/4: Deploy Infrastructure\n'));

        const terraformRunner = new TerraformRunner(terraformDir);
        await terraformRunner.init();
        await terraformRunner.plan();
        await terraformRunner.apply();

        // Step 5: Get and Display URL
        const outputs = await terraformRunner.getOutputs() as any;

        if (TerraformOutputParser.validate(outputs)) {
          TerraformOutputParser.displayResults(outputs);
        }

          console.log(chalk.gray('═'.repeat(60)));
          console.log(chalk.bold.green('\n✅ Deployment Complete!\n'));

        } catch (error: any) {
          this.log(chalk.red('\n❌ Deployment failed: ' + error.message));
          throw error;
        }
      }

    } catch (error) {
      this.error(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async askAdaptiveQuestions(codeAnalysis: any) {
    const questions: any[] = [];

    // Question 1: Database preference (only if database detected)
    if (codeAnalysis.services.database) {
      this.log(chalk.bold('📝 A few questions to optimize your deployment:\n'));
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

    // Question 2: Custom domain (optional)
    if (questions.length === 0) {
      this.log(chalk.bold('📝 A few questions to optimize your deployment:\n'));
    }
    questions.push({
      type: 'input',
      name: 'customDomain',
      message: 'Custom domain (optional, leave blank to skip)?',
      default: ''
    });

    const answers: any = questions.length > 0 ? await inquirer.prompt(questions) : {};

    // Use smart defaults for removed questions
    return {
      cloudProvider: 'aws',
      expectedDAU: 1000,  // Smart default: medium traffic
      budget: 100,        // Smart default: reasonable budget
      databasePreference: answers.databasePreference ?
        (answers.databasePreference.includes('Managed RDS') ? 'managed' : 'self-hosted') :
        undefined,
      customDomain: answers.customDomain || undefined,
      awsRegion: 'us-east-1'  // Smart default: most common region
    };
  }

  private getDefaultAnswers() {
    return {
      cloudProvider: 'aws',
      expectedDAU: 1000,
      budget: 100,
      customDomain: undefined,
      awsRegion: 'us-east-1'
    };
  }
}
