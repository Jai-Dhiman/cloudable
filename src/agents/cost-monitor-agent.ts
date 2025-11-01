import { BaseAgent, type AgentState } from './base-agent.js';
import { CostAnalysisService, type CostAnalysisResult } from '../services/cost-analysis-service.js';

/**
 * Cost Monitor Agent
 * Analyzes AWS costs and generates weekly cost reports
 */
export class CostMonitorAgent extends BaseAgent {
  private costService: CostAnalysisService;

  constructor(options: {
    demoMode?: boolean;
    region?: string;
    hyperspellApiKey?: string;
  } = {}) {
    super({
      name: 'Cost Monitor Agent',
      instructions: `You are a cost monitoring agent that analyzes AWS infrastructure costs.

Your responsibilities:
- Analyze AWS costs for the past week
- Detect cost anomalies and trends
- Generate red flags for potential issues
- Provide cost optimization recommendations
- Query historical data for learning insights

Always provide clear, actionable insights backed by data.`,
      model: 'gpt-4o'
    });

    this.costService = new CostAnalysisService({
      demoMode: options.demoMode || false,
      region: options.region || process.env.AWS_REGION || 'us-east-1',
      hyperspellApiKey: options.hyperspellApiKey
    });
  }

  /**
   * Execute cost analysis for a deployment
   */
  async execute(state: AgentState): Promise<AgentState> {
    try {
      const deploymentId = state.projectId || 'default';

      // Generate cost analysis
      const analysisResult = await this.costService.generateCostAnalysis(deploymentId);

      // Add results to state
      return this.updateState(state, {
        ...state,
        // Store analysis result in a custom field
        costAnalysisResult: analysisResult
      });

    } catch (error) {
      const errorMessage = `Cost Monitor Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return this.addError(state, errorMessage);
    }
  }

  /**
   * Execute with progress callbacks for UI updates
   */
  async executeWithProgress(
    deploymentId: string,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<CostAnalysisResult> {
    try {
      // Stage 1: Fetching cost data
      if (onProgress) onProgress('Fetching AWS cost data...', 0.2);

      const analysisResult = await this.costService.generateCostAnalysis(deploymentId);

      // Stage 2: Analyzing trends
      if (onProgress) onProgress('Analyzing cost trends...', 0.5);

      // Stage 3: Detecting red flags
      if (onProgress) onProgress('Detecting cost anomalies...', 0.7);

      // Stage 4: Generating insights
      if (onProgress) onProgress('Generating learning insights...', 0.9);

      // Stage 5: Complete
      if (onProgress) onProgress('Analysis complete', 1.0);

      return analysisResult;

    } catch (error) {
      throw new Error(`Cost Monitor Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get formatted summary of analysis results
   */
  formatSummary(result: CostAnalysisResult): string {
    const lines: string[] = [];

    lines.push('COST ANALYSIS SUMMARY');
    lines.push('='.repeat(50));
    lines.push('');

    // Cost overview
    lines.push(`Current Week: $${result.lastWeekCost.totalCurrentWeek.toFixed(2)}`);
    lines.push(`Previous Week: $${result.lastWeekCost.totalPreviousWeek.toFixed(2)}`);
    lines.push(`Change: ${result.lastWeekCost.totalChangePercent >= 0 ? '+' : ''}${result.lastWeekCost.totalChangePercent.toFixed(1)}%`);
    lines.push(`Monthly Projection: $${result.expectedMonthlyCost.projected.toFixed(2)}`);
    lines.push('');

    // Red flags
    lines.push(`Red Flags: ${result.redFlagSummary.total}`);
    lines.push(`  Critical: ${result.redFlagSummary.bySeverity.critical}`);
    lines.push(`  Warning: ${result.redFlagSummary.bySeverity.warning}`);
    lines.push(`  Info: ${result.redFlagSummary.bySeverity.info}`);
    lines.push('');

    // Potential savings
    if (result.redFlagSummary.totalPotentialSavings > 0) {
      lines.push(`Potential Savings: $${result.redFlagSummary.totalPotentialSavings.toFixed(2)}/month`);
      lines.push('');
    }

    // Top services
    lines.push('Top Services:');
    result.lastWeekCost.topServices.slice(0, 3).forEach((service, index) => {
      lines.push(`  ${index + 1}. ${service.service}: $${service.currentWeekCost.toFixed(2)} (${service.changePercent >= 0 ? '+' : ''}${service.changePercent.toFixed(1)}%)`);
    });
    lines.push('');

    // Learning insights
    if (result.learningInsights.length > 0) {
      lines.push('Learning Insights:');
      result.learningInsights.forEach((insight) => {
        lines.push(`  • ${insight.message}`);
      });
    }

    return lines.join('\n');
  }
}

// Extend AgentState to include cost analysis result
declare module './base-agent.js' {
  interface AgentState {
    costAnalysisResult?: CostAnalysisResult;
  }
}
