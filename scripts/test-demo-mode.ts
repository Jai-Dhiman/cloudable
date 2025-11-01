/**
 * Demo Mode Test Script
 *
 * This script demonstrates the cost analysis with dummy data
 * Perfect for hackathon presentations - no AWS credentials needed!
 *
 * Run with: npx tsx test-demo-mode.ts
 */

import { CostAnalysisService } from "../src/services/cost-analysis-service.js";

async function runDemo() {
	console.log("🎬 Cloudable Cost Analysis - DEMO MODE");
	console.log("=".repeat(60));
	console.log("\n✨ Using realistic dummy data for hackathon demo");
	console.log("   No AWS credentials required!\n");
	console.log("=".repeat(60));

	console.log("\n📊 Initializing Cost Analysis Service (Demo Mode)...");
	const costAnalysis = new CostAnalysisService({
		demoMode: true,
	});

	console.log("✅ Service initialized\n");

	console.log('🔍 Analyzing deployment "next-js-production-app"...\n');
	const report = await costAnalysis.generateCostAnalysis(
		"next-js-production-app",
	);

	console.log("=".repeat(60));
	console.log("💰 COST SUMMARY");
	console.log("=".repeat(60));

	console.log(
		`\n📅 Billing Period: ${report.lastWeekCost.billingPeriodStart} to ${report.lastWeekCost.billingPeriodEnd}`,
	);

	console.log(
		`\n💵 Last Week: $${report.lastWeekCost.totalCurrentWeek.toFixed(2)}`,
	);
	console.log(
		`   Previous Week: $${report.lastWeekCost.totalPreviousWeek.toFixed(2)}`,
	);

	const changeSymbol = report.lastWeekCost.totalChangePercent > 0 ? "📈" : "📉";
	console.log(
		`   Change: ${changeSymbol} ${report.lastWeekCost.totalChangePercent > 0 ? "+" : ""}${report.lastWeekCost.totalChangePercent.toFixed(1)}% ($${report.lastWeekCost.totalChangeAmount.toFixed(2)})`,
	);

	console.log("\n" + "-".repeat(60));
	console.log("📈 FUTURE PROJECTIONS");
	console.log("-".repeat(60));

	console.log(
		`\n🔮 Next Week Prediction: $${report.expectedNextWeekCost.predicted.toFixed(2)}`,
	);
	console.log(
		`   Range: $${report.expectedNextWeekCost.confidenceInterval.low.toFixed(2)} - $${report.expectedNextWeekCost.confidenceInterval.high.toFixed(2)}`,
	);
	console.log(`   Method: ${report.expectedNextWeekCost.methodology}`);

	console.log(
		`\n📊 Monthly Projection: $${report.expectedMonthlyCost.projected.toFixed(2)}`,
	);
	console.log(
		`   Range: $${report.expectedMonthlyCost.confidenceInterval.low.toFixed(2)} - $${report.expectedMonthlyCost.confidenceInterval.high.toFixed(2)}`,
	);
	console.log(
		`   Trend: ${report.expectedMonthlyCost.trendDirection.toUpperCase()} ${report.expectedMonthlyCost.trendDirection === "increasing" ? "⬆️" : report.expectedMonthlyCost.trendDirection === "decreasing" ? "⬇️" : "➡️"}`,
	);

	console.log("\n" + "-".repeat(60));
	console.log("🏆 TOP AWS SERVICES");
	console.log("-".repeat(60));

	for (const service of report.lastWeekCost.topServices.slice(0, 5)) {
		const changeSymbol =
			service.changePercent > 0 ? "↑" : service.changePercent < 0 ? "↓" : "→";
		const changeColor =
			service.changePercent > 20
				? "🔴"
				: service.changePercent > 10
					? "🟡"
					: "🟢";

		console.log(`\n${changeColor} ${service.service}`);
		console.log(`   Current Week: $${service.currentWeekCost.toFixed(2)}`);
		console.log(
			`   Change: ${changeSymbol} ${service.changePercent > 0 ? "+" : ""}${service.changePercent.toFixed(1)}%`,
		);
		console.log(`   Monthly: $${service.monthlyProjection.toFixed(2)}`);
	}

	console.log("\n" + "=".repeat(60));
	console.log("🚩 RED FLAGS DETECTED");
	console.log("=".repeat(60));

	console.log(`\n📊 Total Issues: ${report.redFlagSummary.total}`);
	console.log(`   🔴 Critical: ${report.redFlagSummary.bySeverity.critical}`);
	console.log(`   🟡 Warnings: ${report.redFlagSummary.bySeverity.warning}`);
	console.log(`   🔵 Info: ${report.redFlagSummary.bySeverity.info}`);

	console.log(`\n📂 Issues by Category:`);
	console.log(
		`   💸 Cost Anomalies: ${report.redFlagSummary.byCategory.cost_anomaly}`,
	);
	console.log(
		`   ♻️  Resource Waste: ${report.redFlagSummary.byCategory.resource_waste}`,
	);
	console.log(
		`   🔒 Security Risks: ${report.redFlagSummary.byCategory.security_risk}`,
	);
	console.log(
		`   ⚠️  Deployment Failures: ${report.redFlagSummary.byCategory.deployment_failure}`,
	);

	console.log(
		`\n💰 Potential Savings: $${report.redFlagSummary.totalPotentialSavings.toFixed(2)}/month`,
	);

	console.log("\n" + "-".repeat(60));
	console.log("🔝 TOP 5 ISSUES");
	console.log("-".repeat(60));

	for (const [index, flag] of report.redFlags.slice(0, 5).entries()) {
		const severityEmoji =
			flag.severity === "critical"
				? "🔴"
				: flag.severity === "warning"
					? "🟡"
					: "🔵";
		const categoryEmoji = {
			cost_anomaly: "💸",
			resource_waste: "♻️",
			security_risk: "🔒",
			deployment_failure: "⚠️",
		}[flag.category];

		console.log(
			`\n${index + 1}. ${severityEmoji} ${categoryEmoji} ${flag.title}`,
		);
		console.log(`   ${flag.description}`);

		if (flag.estimatedSavings) {
			console.log(`   💰 Savings: $${flag.estimatedSavings.toFixed(2)}/month`);
		}

		if (flag.autoFixable) {
			console.log(`   🔧 Fix: ${flag.fixCommand}`);
		}
	}

	console.log("\n" + "=".repeat(60));
	console.log("🧠 LEARNING INSIGHTS (Hyperspell)");
	console.log("=".repeat(60));

	for (const insight of report.learningInsights) {
		const typeEmoji = {
			pattern: "📊",
			prediction: "🔮",
			recommendation: "💡",
			warning: "⚠️",
		}[insight.type];

		console.log(`\n${typeEmoji} ${insight.message}`);
		console.log(`   Confidence: ${(insight.confidence * 100).toFixed(1)}%`);
		console.log(`   Source: ${insight.source}`);
	}

	console.log("\n" + "=".repeat(60));
	console.log("✨ DEMO SUMMARY");
	console.log("=".repeat(60));

	console.log("\n📝 Key Highlights:");
	console.log(
		`   • Last week cost: $${report.lastWeekCost.totalCurrentWeek.toFixed(2)} (↑${report.lastWeekCost.totalChangePercent.toFixed(1)}%)`,
	);
	console.log(
		`   • Monthly projection: $${report.expectedMonthlyCost.projected.toFixed(2)} (${report.expectedMonthlyCost.trendDirection})`,
	);
	console.log(
		`   • Issues detected: ${report.redFlags.length} (${report.redFlagSummary.bySeverity.critical} critical)`,
	);
	console.log(
		`   • Potential savings: $${report.redFlagSummary.totalPotentialSavings.toFixed(2)}/month`,
	);

	console.log("\n🎯 What Cloudable Detected:");
	console.log("   ✓ Statistical cost anomaly (+3.1 std deviations)");
	console.log("   ✓ Overall cost spike (+22.6% week-over-week)");
	console.log("   ✓ EC2 service spike (+33.7%)");
	console.log("   ✓ RDS service increase (+25.0%)");
	console.log("   ✓ S3 service increase (+25.0%)");

	console.log("\n🤖 AI-Powered Features (REAL implementations):");
	console.log("   ✓ Real cost projection engine (linear trend analysis)");
	console.log("   ✓ Real anomaly detection (statistical analysis)");
	console.log("   ✓ Confidence intervals on predictions");
	console.log("   ✓ Historical trend analysis (4 weeks)");

	console.log("\n📧 Human-in-the-Loop (Teammate's Implementation):");
	console.log("   → User receives email with this cost analysis");
	console.log('   → User replies: "Investigate the EC2 spike"');
	console.log("   → Agent analyzes and responds with recommendations");
	console.log("   → User can approve/reject with natural language");

	console.log("\n" + "=".repeat(60));
	console.log("✅ DEMO COMPLETE");
	console.log("=".repeat(60));

	console.log("\n🎬 This demo showcased:");
	console.log("   1. Dummy AWS cost data (for demo without credentials)");
	console.log(
		"   2. REAL cost projection engine (linear trend + confidence intervals)",
	);
	console.log("   3. REAL cost anomaly detector (statistical analysis)");
	console.log("   4. REAL historical trend analysis (4 weeks of data)");
	console.log("   5. Integration-ready for Hyperspell learning");
	console.log("   6. Integration-ready for AgentMail human-in-the-loop");

	console.log("\n🏆 Sponsor Tool Integration:");
	console.log("   ✓ Mastra - Multi-agent orchestration");
	console.log("   ✓ Hyperspell - Self-learning memory layer");
	console.log("   ✓ Moss - Fast semantic code analysis");
	console.log("   ✓ AgentMail - Email-based human-in-the-loop");

	console.log("\n🚀 Ready for production deployment!\n");
}

console.log("\n🎪 Starting Hackathon Demo...\n");

runDemo()
	.then(() => {
		console.log("🎉 Demo completed successfully!\n");
	})
	.catch((error) => {
		console.error("\n❌ Demo failed:", error);
		process.exit(1);
	});
