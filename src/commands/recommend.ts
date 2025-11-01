import { Args, Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import ora from 'ora'
import { AIProjectAnalyzer } from '../analyzers/ai-project-analyzer.js'
import { basename } from 'node:path'

export default class Recommend extends Command {
  static description = 'Get AI-powered AWS deployment recommendations for your project'

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> /path/to/project',
  ]

  static flags = {}

  static args = {
    path: Args.string({
      description: 'Path to the project directory',
      required: false,
      default: '.',
    }),
  }

  async run(): Promise<void> {
    const { args } = await this.parse(Recommend)
    const projectPath = resolve(args.path)
    const projectName = basename(projectPath)

    this.log(`\nGetting deployment recommendations for: ${projectName}\n`)

    try {
      // Step 1: Gather all project files
      const spinner = ora('Reading project files...').start()
      const analyzer = new AIProjectAnalyzer(projectPath)
      const files = await analyzer.gatherProjectFiles()
      const formattedFiles = analyzer.formatFilesForAI(files)
      spinner.succeed('Files read')

      // Step 2: Get AI analysis
      const analysisSpinner = ora('AI analyzing your codebase...').start()
      
      const analysisResponse = await fetch('https://backend-8a0ifztqi-dpakkks-projects.vercel.app/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectFiles: formattedFiles,
          projectName: projectName,
        }),
      })

      const analysisData = await analysisResponse.json() as any
      
      if (!analysisData.success) {
        analysisSpinner.fail('AI analysis failed')
        this.error('Failed to analyze project')
        return
      }

      analysisSpinner.succeed('Analysis complete')

      // Step 3: Get AI deployment recommendations
      const recommendSpinner = ora('AI generating deployment recommendations...').start()
      
      const recommendResponse = await fetch('https://backend-8a0ifztqi-dpakkks-projects.vercel.app/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiAnalysis: analysisData.analysis,
          projectFiles: formattedFiles,
          projectName: projectName,
        }),
      })

      const recommendData = await recommendResponse.json() as any
      
      if (!recommendData.success) {
        recommendSpinner.fail('Recommendation failed')
        this.error('Failed to get deployment recommendations')
        return
      }

      recommendSpinner.succeed('Recommendations ready')

      // Display analysis summary
      this.log('\n' + '='.repeat(60))
      this.log('PROJECT ANALYSIS')
      this.log('='.repeat(60) + '\n')
      this.log(analysisData.analysis)
      
      // Display recommendations
      this.log('\n' + '='.repeat(60))
      this.log('AWS DEPLOYMENT RECOMMENDATIONS')
      this.log('='.repeat(60) + '\n')
      this.log(recommendData.recommendation)
      this.log('\n' + '='.repeat(60) + '\n')

    } catch (error) {
      this.error(`Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
