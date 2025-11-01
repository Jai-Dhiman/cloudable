/**
 * Test Report Generation with PDF and Email
 * 
 * This script tests the complete report generation flow:
 * 1. Cost analysis generation
 * 2. PDF creation
 * 3. Email sending with PDF attachment
 * 
 * Usage:
 *   npx tsx scripts/test-report-generation.ts
 * 
 * Set environment variables:
 *   - AGENTMAIL_API_KEY (required for email)
 *   - RECIPIENT_EMAIL (optional, defaults to demo mode without sending)
 */

import { ReportGenerationService } from '../src/services/report-generation.service.js';
import { PDFGeneratorService } from '../src/services/pdf-generator.service.js';
import { ReportFormatter } from '../src/utils/report-formatter.js';
import { CostAnalysisService } from '../src/services/cost-analysis-service.js';

async function testReportGeneration() {
	console.log('🧪 Testing Report Generation Flow\n');

	const deploymentId = 'test-deployment-123';
	const recipientEmail = process.env.RECIPIENT_EMAIL;

	console.log('Configuration:');
	console.log(`  Deployment ID: ${deploymentId}`);
	console.log(`  Recipient Email: ${recipientEmail || 'Not set (will skip email)'}`);
	console.log(`  Demo Mode: true\n`);

	try {
		// Initialize service with demo mode
		const reportService = new ReportGenerationService({
			demoMode: true,
		});

		console.log('📊 Step 1: Generating cost analysis...');
		const analysisResult = await reportService.generateAnalysisOnly(deploymentId);
		console.log(`✅ Analysis complete. Report ID: ${analysisResult.metadata.reportId}\n`);

		console.log('📄 Step 2: Generating PDF...');
		const pdfPath = await reportService.generatePDFOnly(deploymentId);
		console.log(`✅ PDF generated: ${pdfPath}\n`);

		if (recipientEmail) {
			console.log('📧 Step 3: Sending email with PDF attachment...');
			const result = await reportService.generateAndSendReport(deploymentId, {
				recipientEmail,
				generatePDF: true,
				sendEmail: true,
				demoMode: true,
			});

			if (result.emailSent) {
				console.log(`✅ Email sent successfully!`);
				console.log(`   Message ID: ${result.messageId}`);
				console.log(`   Thread ID: ${result.threadId}`);
				if (result.pdfPath) {
					console.log(`   PDF saved at: ${result.pdfPath}`);
				}
			} else {
				console.log(`⚠️  Email not sent: ${result.error || 'Unknown error'}`);
			}
		} else {
			console.log('⏭️  Step 3: Skipping email (RECIPIENT_EMAIL not set)');
			console.log('\n💡 To test email sending, set RECIPIENT_EMAIL environment variable');
		}

		console.log('\n✅ Report generation test complete!');

		// Test PDF buffer generation directly
		console.log('\n📦 Testing PDF buffer generation...');
		const costAnalysis = new CostAnalysisService({ demoMode: true });
		const costResult = await costAnalysis.generateCostAnalysis(deploymentId);
		const pdfData = ReportFormatter.formatForPDF(costResult, deploymentId);
		const pdfBuffer = await PDFGeneratorService.generatePDFBuffer(pdfData);
		console.log(`✅ PDF buffer generated: ${pdfBuffer.length} bytes`);

	} catch (error) {
		console.error('\n❌ Error during report generation:');
		console.error(error instanceof Error ? error.message : String(error));
		if (error instanceof Error && error.stack) {
			console.error('\nStack trace:');
			console.error(error.stack);
		}
		process.exit(1);
	}
}

// Run the test
testReportGeneration().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});

