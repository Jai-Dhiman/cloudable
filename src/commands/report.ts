import { Args, Command, Flags } from '@oclif/core'
import chalk from 'chalk'
import ora from 'ora'
import { ReportGenerationService } from '../services/report-generation.service.js'

export default class Report extends Command {
  static description = 'Generate and send cost reports with PDF attachments'

  static examples = [
    '<%= config.bin %> <%= command.id %> <deployment-id>',
    '<%= config.bin %> <%= command.id %> my-app --email user@example.com',
    '<%= config.bin %> <%= command.id %> my-app --pdf-only --output ./reports',
    '<%= config.bin %> <%= command.id %> my-app --demo',
  ]

  static flags = {
    email: Flags.string({
      char: 'e',
      description: 'Email address to send the report to',
    }),
    'pdf-only': Flags.boolean({
      description: 'Generate PDF only, do not send email',
      default: false,
    }),
    'no-pdf': Flags.boolean({
      description: 'Skip PDF generation',
      default: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output directory for PDF file (when using --pdf-only)',
    }),
    demo: Flags.boolean({
      description: 'Use demo mode with sample data',
      default: false,
    }),
  }

  static args = {
    deploymentId: Args.string({
      description: 'Deployment ID to generate report for',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Report)
    const deploymentId = args.deploymentId

    this.log(chalk.bold.cyan('\n📊 Cloudable Cost Report Generator\n'))

    try {
      const reportService = new ReportGenerationService({
        demoMode: flags.demo,
      })

      // Check if email is required but not provided
      if (!flags['pdf-only'] && !flags.email && !flags.demo) {
        this.error(
          chalk.red(
            'Error: Email address is required when sending reports.\n' +
              'Use --email <address> or --pdf-only to skip email sending.',
          ),
        )
        return
      }

      const spinner = ora('Generating cost analysis...').start()

      // Determine what to generate
      const generatePDF = !flags['no-pdf']
      const sendEmail = !flags['pdf-only'] && flags.email

      if (flags['pdf-only']) {
        spinner.succeed('Generating PDF only (no email)')

        const pdfPath = await reportService.generatePDFOnly(
          deploymentId,
          flags.output
            ? `${flags.output}/cost-report-${deploymentId}-${Date.now()}.pdf`
            : undefined,
          { demoMode: flags.demo, generatePDF: true },
        )

        this.log(chalk.green(`\n✅ PDF generated successfully:`))
        this.log(chalk.gray(`   ${pdfPath}\n`))
      } else if (sendEmail) {
        spinner.text = 'Generating report and sending email...'
        
        const result = await reportService.generateAndSendReport(
          deploymentId,
          {
            recipientEmail: flags.email,
            generatePDF: generatePDF,
            sendEmail: true,
            demoMode: flags.demo,
          },
        )

        if (result.emailSent) {
          spinner.succeed('Report generated and email sent successfully!')

          this.log(chalk.green(`\n✅ Report Summary:`))
          this.log(chalk.gray(`   Report ID: ${result.reportId}`))
          this.log(chalk.gray(`   Deployment: ${result.deploymentId}`))
          this.log(chalk.gray(`   Message ID: ${result.messageId}`))
          if (result.pdfPath) {
            this.log(chalk.gray(`   PDF saved at: ${result.pdfPath}`))
          }
          this.log('')
        } else {
          spinner.fail('Failed to send email')
          this.error(
            chalk.red(`\n❌ Error: ${result.error || 'Unknown error'}\n`),
          )
        }
      } else {
        // Generate analysis only
        spinner.text = 'Generating analysis...'
        const analysis = await reportService.generateAnalysisOnly(deploymentId)
        spinner.succeed('Analysis complete')

        this.log(chalk.green(`\n✅ Analysis Summary:`))
        this.log(chalk.gray(`   Report ID: ${analysis.metadata.reportId}`))
        this.log(
          chalk.gray(
            `   Last Week: ${analysis.costSummary.lastWeek.formatted}`,
          ),
        )
        this.log(
          chalk.gray(
            `   Change: ${analysis.costSummary.change.formatted} (${analysis.costSummary.change.direction})`,
          ),
        )
        this.log(
          chalk.gray(
            `   Monthly Projection: ${analysis.projections.monthly.formatted}`,
          ),
        )
        this.log(
          chalk.gray(
            `   Red Flags: ${analysis.redFlags.total} (${analysis.redFlags.summary.critical} critical)`,
          ),
        )
        this.log('')
      }
    } catch (error) {
      this.error(
        chalk.red(
          `\n❌ Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
        ),
      )
    }
  }
}

