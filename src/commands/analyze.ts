import { Args, Command, Flags } from '@oclif/core'
import { resolve } from 'node:path'
import { basename } from 'node:path'
import ora from 'ora'
import boxen from 'boxen'
import chalk from 'chalk'
import gradient from 'gradient-string'
import { AIProjectAnalyzer } from '../analyzers/ai-project-analyzer.js'

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

    this.log('\n' + boxen(
      chalk.bold.cyan('AI-Powered Project Analysis\n\n') +
      chalk.white('Project: ') + chalk.cyan(projectName) + '\n' +
      chalk.white('Path: ') + chalk.gray(projectPath),
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'cyan',
        align: 'center'
      }
    ));

    try {
      // Gather all project files
      const spinner = ora(chalk.cyan('Reading project files...')).start()
      const analyzer = new AIProjectAnalyzer(projectPath)
      const files = await analyzer.gatherProjectFiles()
      const formattedFiles = analyzer.formatFilesForAI(files)
      const fileCount = Object.keys(files).filter(key => files[key as keyof typeof files]).length
      spinner.succeed(chalk.green(`Files read (${fileCount} files analyzed)`))

      // Send to AI for deep analysis
      const aiSpinner = ora(chalk.cyan('AI analyzing your codebase... (this may take 10-20 seconds)')).start()

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
        aiSpinner.fail(chalk.red('AI analysis failed'))
        this.error('Failed to analyze project with AI')
        return
      }

      aiSpinner.succeed(chalk.green('AI analysis complete'))

      // Display AI analysis
      this.log('\n' + boxen(
        gradient.pastel('AI ANALYSIS RESULTS\n\n') +
        chalk.white(data.analysis),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'magenta'
        }
      ))

      this.log('\n' + boxen(
        chalk.cyan('💡 Next Step\n\n') +
        chalk.gray('Run ') + chalk.white('cloudable recommend') + chalk.gray(' to get AWS deployment recommendations'),
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'blue'
        }
      ) + '\n')

    } catch (error) {
      this.error(`Failed to analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
