/**
 * Test PDF Generation and Email Sending
 * 
 * This script tests the complete flow:
 * 1. Cost analysis generation (demo mode)
 * 2. PDF creation
 * 3. Email sending with PDF attachment
 * 
 * Usage:
 *   npx tsx scripts/test-pdf-email.ts
 */

import { ReportGenerationService } from '../src/services/report-generation.service.js';
import chalk from 'chalk';

async function testPDFAndEmail() {
	console.log(chalk.bold.cyan('\n🧪 Testing PDF Generation and Email Sending\n'));

	const deploymentId = 'test-deployment-123';
	const recipientEmail = 'nihal.nihalani@gmail.com';

	// Set environment variables if not already set
	if (!process.env.AGENTMAIL_API_KEY) {
		process.env.AGENTMAIL_API_KEY = 'am_cfc6817e2e770e96620c3673312e6bee92027f395275c7ca642c30163d25cec6';
	}
	if (!process.env.HYPERSPELL_API_KEY) {
		process.env.HYPERSPELL_API_KEY = 'hs2-178-Jpll4njaI08KaS12HWNA7KlnNxDCtt3b';
	}

	console.log('Configuration:');
	console.log(`  Deployment ID: ${deploymentId}`);
	console.log(`  Recipient Email: ${recipientEmail}`);
	console.log(`  Demo Mode: true`);
	console.log(`  AGENTMAIL_API_KEY: ${process.env.AGENTMAIL_API_KEY ? 'Set ✓' : 'Not set ✗'}\n`);

	if (!process.env.AGENTMAIL_API_KEY) {
		console.error(chalk.red('❌ AGENTMAIL_API_KEY is required'));
		process.exit(1);
	}

	try {
		// Initialize service with demo mode
		const reportService = new ReportGenerationService({
			demoMode: true,
		});

		console.log(chalk.cyan('📊 Step 1: Generating cost analysis...'));
		const analysis = await reportService.generateAnalysisOnly(deploymentId);
		console.log(chalk.green(`✅ Analysis complete. Report ID: ${analysis.metadata.reportId}`));
		console.log(`   Last Week: ${analysis.costSummary.lastWeek.formatted}`);
		console.log(`   Change: ${analysis.costSummary.change.formatted}`);
		console.log(`   Monthly Projection: ${analysis.projections.monthly.formatted}`);
		console.log(`   Red Flags: ${analysis.redFlags.total}\n`);

		console.log(chalk.cyan('📄 Step 2: Generating PDF...'));
		const pdfBuffer = await reportService.generatePDFOnly(deploymentId);
		console.log(chalk.green(`✅ PDF generated: ${pdfBuffer}\n`));

		console.log(chalk.cyan('📧 Step 3: Sending email with PDF attachment...'));
		const result = await reportService.generateAndSendReport(deploymentId, {
			recipientEmail,
			generatePDF: true,
			sendEmail: true,
			demoMode: true,
		});

		if (result.emailSent) {
			console.log(chalk.green(`\n✅ SUCCESS! Email sent successfully!`));
			console.log(chalk.gray(`   Report ID: ${result.reportId}`));
			console.log(chalk.gray(`   Deployment: ${result.deploymentId}`));
			console.log(chalk.gray(`   Message ID: ${result.messageId || 'N/A'}`));
			console.log(chalk.gray(`   Thread ID: ${result.threadId || 'N/A'}`));
			if (result.pdfPath) {
				console.log(chalk.gray(`   PDF saved at: ${result.pdfPath}`));
			}
			console.log(chalk.cyan(`\n📬 Check your inbox at: ${recipientEmail}\n`));
		} else {
			console.error(chalk.red(`\n❌ Email sending failed`));
			console.error(chalk.red(`   Error: ${result.error || 'Unknown error'}`));
			process.exit(1);
		}

	} catch (error) {
		console.error(chalk.red('\n❌ Error during test:'));
		console.error(error instanceof Error ? error.message : String(error));
		if (error instanceof Error && error.stack) {
			console.error(chalk.gray('\nStack trace:'));
			console.error(chalk.gray(error.stack));
		}
		process.exit(1);
	}
}

// Run the test
testPDFAndEmail().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

