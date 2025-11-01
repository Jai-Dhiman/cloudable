/**
 * Generate Demo Report for PDF/Email Integration
 *
 * This script generates a JSON object ready for:
 * 1. PDF report generation
 * 2. AgentMail email delivery
 *
 * Run with: npx tsx generate-demo-report.ts > demo-report.json
 */

import { CostAnalysisService } from './src/services/cost-analysis-service.js';
import { ReportFormatter } from './src/utils/report-formatter.js';

async function generateDemoReport() {
  const costAnalysis = new CostAnalysisService({
    demoMode: true,
  });

  const deploymentId = 'next-js-production-app';
  const result = await costAnalysis.generateCostAnalysis(deploymentId);

  const pdfData = ReportFormatter.formatForPDF(result, deploymentId);

  console.log(JSON.stringify(pdfData, null, 2));
}

generateDemoReport().catch(error => {
  console.error('Error generating report:', error);
  process.exit(1);
});
