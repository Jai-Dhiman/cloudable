import {Args, Command, Flags} from '@oclif/core'
import {resolve} from 'node:path'
import {writeFile} from 'fs/promises'
import {ProjectAnalyzer} from '../analyzers/project-analyzer.js'
import {PDFGeneratorService} from '../../pdf_generator/service.js'

export default class Analyze extends Command {
  static description = 'Analyze a project to understand its deployment requirements'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> /path/to/project',
    '<%= config.bin %> <%= command.id %> --verbose',
    '<%= config.bin %> <%= command.id %> --pdf=default',
    '<%= config.bin %> <%= command.id %> --pdf=executive --pdf-output=report.pdf',
  ]

  static flags = {
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed analysis output',
      default: false,
    }),
    pdf: Flags.string({
      description: 'Generate PDF report (specify template: default, detailed, or executive)',
      options: ['default', 'detailed', 'executive'],
    }),
    'pdf-output': Flags.string({
      description: 'Output path for PDF file (default: {project-name}-analysis.pdf)',
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
    
    this.log(`\n🔍 Analyzing project at: ${projectPath}\n`)

    try {
      const analyzer = new ProjectAnalyzer(projectPath)
      const analysis = await analyzer.analyze({verbose: flags.verbose})

      // Display results
      this.displayResults(analysis, flags.verbose)

      // Generate PDF if requested
      if (flags.pdf) {
        await this.generatePDF(analysis, flags.pdf, flags['pdf-output'] || null)
      }
    } catch (error) {
      this.error(`Failed to analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private displayResults(analysis: any, verbose: boolean): void {
    // Project Info
    this.log(`📦 Project: ${analysis.projectName}`)
    this.log(`📊 Confidence Score: ${analysis.confidence}%\n`)

    // Framework Detection
    this.log('🎯 Framework Detection')
    this.log(`   Framework: ${analysis.framework.name} ${analysis.framework.version || ''}`)
    this.log(`   Type: ${analysis.framework.type}`)
    this.log(`   Runtime: ${analysis.framework.runtime}`)
    if (analysis.framework.packageManager) {
      this.log(`   Package Manager: ${analysis.framework.packageManager}`)
    }

    this.log('')

    // Deployment Docs
    this.log('📄 Deployment Documentation')
    this.log(`   ${analysis.deploymentDocs.hasDockerfile ? '✅' : '❌'} Dockerfile`)
    this.log(`   ${analysis.deploymentDocs.hasDockerCompose ? '✅' : '❌'} docker-compose.yml`)
    this.log(`   ${analysis.deploymentDocs.hasTerraform ? '✅' : '❌'} Terraform`)
    this.log(`   ${analysis.deploymentDocs.hasReadme ? '✅' : '❌'} README`)
    
    if (analysis.deploymentDocs.cicdConfig?.platform) {
      this.log(`   ✅ CI/CD: ${analysis.deploymentDocs.cicdConfig.platform}`)
    }

    if (analysis.deploymentDocs.dockerComposeServices?.length > 0) {
      this.log(`   Docker services: ${analysis.deploymentDocs.dockerComposeServices.join(', ')}`)
    }

    this.log('')

    // Services Required
    this.log('🗄️  Services Required')
    
    if (analysis.services.database) {
      this.log(`   ✅ Database: ${analysis.services.database.type}`)
      this.log(`      Detected from: ${analysis.services.database.detectedFrom}`)
    } else {
      this.log('   ❌ Database: None detected')
    }

    if (analysis.services.cache) {
      this.log(`   ✅ Cache: ${analysis.services.cache.type}`)
      this.log(`      Detected from: ${analysis.services.cache.detectedFrom}`)
    } else {
      this.log('   ❌ Cache: None detected')
    }

    if (analysis.services.storage) {
      this.log(`   ✅ Storage: ${analysis.services.storage.type}`)
      this.log(`      Detected from: ${analysis.services.storage.detectedFrom}`)
    }

    if (analysis.services.queue) {
      this.log(`   ✅ Queue: ${analysis.services.queue.type}`)
      this.log(`      Detected from: ${analysis.services.queue.detectedFrom}`)
    }

    if (analysis.services.websockets) {
      this.log('   ✅ WebSockets: Required')
      this.log(`      Detected from: ${analysis.services.websockets.detectedFrom}`)
    }

    this.log('')

    // Build Configuration
    this.log('⚙️  Build Configuration')
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
      this.log('🔐 Environment Variables')
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
    this.log('💡 Deployment Recommendation')
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

  private async generatePDF(analysis: any, templateId: string, outputPath: string | null): Promise<void> {
    try {
      this.log('\n📄 Generating PDF report...')
      
      const pdfService = new PDFGeneratorService()
      const pdfBuffer = await pdfService.generatePDF(analysis, templateId)
      
      const fileName = outputPath || `${analysis.projectName}-analysis.pdf`
      const fullPath = resolve(fileName)
      
      await writeFile(fullPath, pdfBuffer)
      this.log(`✅ PDF report generated: ${fullPath}\n`)
    } catch (error) {
      this.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

