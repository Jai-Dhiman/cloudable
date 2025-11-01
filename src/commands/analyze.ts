import {Args, Command, Flags} from '@oclif/core'
import {resolve} from 'node:path'
import ora from 'ora'
import {ProjectAnalyzer} from '../analyzers/project-analyzer.js'
import {aiHelper} from '../utils/ai-helper.js'

export default class Analyze extends Command {
  static description = 'Analyze a project to understand its deployment requirements'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> /path/to/project',
    '<%= config.bin %> <%= command.id %> --verbose',
  ]

  static flags = {
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed analysis output',
      default: false,
    }),
  }

  static args = {
    path: Args.string({
      description: 'Path to the project directory',
      required: false,
      default: '.',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Analyze)

    const projectPath = resolve(args.path)
    
    this.log(`\nAnalyzing project at: ${projectPath}\n`)

    try {
      const spinner = ora('Scanning codebase...').start()
      const analyzer = new ProjectAnalyzer(projectPath)
      const analysis = await analyzer.analyze({verbose: flags.verbose})
      spinner.succeed('Analysis complete')

      // Display results
      this.displayResults(analysis, flags.verbose)

      // AI-powered insights
      if (aiHelper.isEnabled()) {
        const aiSpinner = ora('Getting AI insights...').start()
        const aiInsights = await aiHelper.analyzeCodebase(analysis)
        aiSpinner.succeed('AI insights ready')
        
        this.log('\nAI-Powered Insights:')
        this.log(`${aiInsights}\n`)
      }
    } catch (error) {
      this.error(`Failed to analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private displayResults(analysis: any, verbose: boolean): void {
    // Project Info
    this.log(`\nProject: ${analysis.projectName}`)
    this.log(`Confidence Score: ${analysis.confidence}%\n`)

    // Framework Detection
    this.log('Framework Detection')
    this.log(`   Framework: ${analysis.framework.name} ${analysis.framework.version || ''}`)
    this.log(`   Type: ${analysis.framework.type}`)
    this.log(`   Runtime: ${analysis.framework.runtime}`)
    if (analysis.framework.packageManager) {
      this.log(`   Package Manager: ${analysis.framework.packageManager}`)
    }

    this.log('')

    // Deployment Docs
    this.log('Deployment Documentation')
    this.log(`   ${analysis.deploymentDocs.hasDockerfile ? '[YES]' : '[NO]'} Dockerfile`)
    this.log(`   ${analysis.deploymentDocs.hasDockerCompose ? '[YES]' : '[NO]'} docker-compose.yml`)
    this.log(`   ${analysis.deploymentDocs.hasTerraform ? '[YES]' : '[NO]'} Terraform`)
    this.log(`   ${analysis.deploymentDocs.hasReadme ? '[YES]' : '[NO]'} README`)
    
    if (analysis.deploymentDocs.cicdConfig?.platform) {
      this.log(`   [YES] CI/CD: ${analysis.deploymentDocs.cicdConfig.platform}`)
    }

    if (analysis.deploymentDocs.dockerComposeServices?.length > 0) {
      this.log(`   Docker services: ${analysis.deploymentDocs.dockerComposeServices.join(', ')}`)
    }

    this.log('')

    // Services Required
    this.log('Services Required')
    
    if (analysis.services.database) {
      this.log(`   [YES] Database: ${analysis.services.database.type}`)
      this.log(`         Detected from: ${analysis.services.database.detectedFrom}`)
    } else {
      this.log('   [NO] Database: None detected')
    }

    if (analysis.services.cache) {
      this.log(`   [YES] Cache: ${analysis.services.cache.type}`)
      this.log(`         Detected from: ${analysis.services.cache.detectedFrom}`)
    } else {
      this.log('   [NO] Cache: None detected')
    }

    if (analysis.services.storage) {
      this.log(`   [YES] Storage: ${analysis.services.storage.type}`)
      this.log(`         Detected from: ${analysis.services.storage.detectedFrom}`)
    }

    if (analysis.services.queue) {
      this.log(`   [YES] Queue: ${analysis.services.queue.type}`)
      this.log(`         Detected from: ${analysis.services.queue.detectedFrom}`)
    }

    if (analysis.services.websockets) {
      this.log('   [YES] WebSockets: Required')
      this.log(`         Detected from: ${analysis.services.websockets.detectedFrom}`)
    }

    this.log('')

    // Build Configuration
    this.log('Build Configuration')
    if (analysis.buildConfig.installCommand) {
      this.log(`   Install: ${analysis.buildConfig.installCommand}`)
    }

    if (analysis.buildConfig.buildCommand) {
      this.log(`   Build: ${analysis.buildConfig.buildCommand}`)
    }

    if (analysis.buildConfig.startCommand) {
      this.log(`   Start: ${analysis.buildConfig.startCommand}`)
    }

    if (analysis.buildConfig.port) {
      this.log(`   Port: ${analysis.buildConfig.port}`)
    }

    if (analysis.buildConfig.healthCheckPath) {
      this.log(`   Health Check: ${analysis.buildConfig.healthCheckPath}`)
    }

    this.log('')

    // Environment Variables
    if (analysis.environmentVars.length > 0) {
      this.log('Environment Variables')
      if (verbose) {
        for (const envVar of analysis.environmentVars) {
          this.log(`   ${envVar.key}${envVar.example ? ` = ${envVar.example}` : ''}`)
        }
      } else {
        this.log(`   Found ${analysis.environmentVars.length} environment variables`)
        this.log('   Use --verbose to see details')
      }

      this.log('')
    }

    // Deployment Recommendation
    this.log('Deployment Recommendation')
    const recommendation = this.getDeploymentRecommendation(analysis)
    this.log(`   ${recommendation}\n`)
  }

  private getDeploymentRecommendation(analysis: any): string {
    const {framework, services} = analysis

    // Already has Docker
    if (analysis.deploymentDocs.hasDockerCompose) {
      return 'Use docker-compose.yml for AWS ECS deployment'
    }

    if (analysis.deploymentDocs.hasDockerfile) {
      return 'Use existing Dockerfile for containerized deployment'
    }

    // Framework-specific recommendations
    switch (framework.framework) {
      case 'nextjs': {
        return 'Deploy to AWS ECS with Fargate (SSR support needed)'
      }

      case 'remix': {
        return 'Deploy to AWS ECS with Fargate or Lambda (depending on adapter)'
      }

      case 'react':
      case 'vue':
      case 'svelte':
      case 'angular': {
        return 'Static build → S3 + CloudFront (CDN)'
      }

      case 'express':
      case 'fastify':
      case 'nestjs': {
        return services.database 
          ? 'Deploy to AWS ECS Fargate with RDS'
          : 'Deploy to AWS Lambda (stateless API)'
      }

      case 'fastapi':
      case 'flask': {
        return services.database
          ? 'Deploy to AWS ECS with RDS'
          : 'Deploy to AWS Lambda with container support'
      }

      case 'django': {
        return 'Deploy to AWS ECS with RDS (requires long-running server)'
      }

      case 'gin':
      case 'fiber': {
        return 'Deploy to AWS ECS or EC2 (Go binary)'
      }

      default: {
        return 'Deploy to AWS ECS Fargate (universal containerized deployment)'
      }
    }
  }
}

