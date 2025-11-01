import { Args, Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import ora from 'ora'
import { AIProjectAnalyzer } from '../analyzers/ai-project-analyzer.js'
import { basename } from 'node:path'

export default class Analyze extends Command {
  static description = 'Analyze your project using AI to understand its structure and deployment needs'

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
    const { args } = await this.parse(Analyze)
    const projectPath = resolve(args.path)
    const projectName = basename(projectPath)

    this.log(`\nAnalyzing project: ${projectName}\n`)

    try {
      // Gather all project files
      const spinner = ora('Reading project files...').start()
      const analyzer = new AIProjectAnalyzer(projectPath)
      const files = await analyzer.gatherProjectFiles()
      const formattedFiles = analyzer.formatFilesForAI(files)
      spinner.succeed('Files read')

      // Send to AI for deep analysis
      const aiSpinner = ora('AI analyzing your codebase... (this may take 10-20 seconds)').start()
      
      const response = await fetch('https://backend-qmc2r78ko-dpakkks-projects.vercel.app/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectFiles: formattedFiles,
          projectName: projectName,
        }),
      })

      const data = await response.json() as any
      
      if (!data.success) {
        aiSpinner.fail('AI analysis failed')
        this.error('Failed to analyze project with AI')
        return
      }

      aiSpinner.succeed('AI analysis complete')

      // Display AI analysis
      this.log('\n' + '='.repeat(60))
      this.log('AI-POWERED PROJECT ANALYSIS')
      this.log('='.repeat(60) + '\n')
      this.log(data.analysis)
      this.log('\n' + '='.repeat(60) + '\n')

      this.log('💡 TIP: Run "cloudable recommend" to get AWS deployment recommendations\n')

    } catch (error) {
      this.error(`Failed to analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
