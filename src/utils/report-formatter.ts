import type { CostAnalysisResult } from '../services/cost-analysis-service.js';

export interface PDFReportData {
  metadata: {
    reportId: string;
    generatedAt: string;
    deploymentId: string;
    billingPeriod: {
      start: string;
      end: string;
    };
  };
  costSummary: {
    lastWeek: {
      total: number;
      formatted: string;
    };
    previousWeek: {
      total: number;
      formatted: string;
    };
    change: {
      amount: number;
      percent: number;
      formatted: string;
      direction: 'up' | 'down' | 'neutral';
    };
  };
  projections: {
    nextWeek: {
      predicted: number;
      formatted: string;
      confidenceInterval: {
        low: number;
        high: number;
        formatted: string;
      };
      methodology: string;
    };
    monthly: {
      projected: number;
      formatted: string;
      confidenceInterval: {
        low: number;
        high: number;
        formatted: string;
      };
      trend: 'increasing' | 'decreasing' | 'stable';
      trendDescription: string;
    };
  };
  topServices: Array<{
    name: string;
    currentWeekCost: number;
    currentWeekFormatted: string;
    changePercent: number;
    changeFormatted: string;
    monthlyProjection: number;
    monthlyFormatted: string;
  }>;
  redFlags: {
    total: number;
    summary: {
      critical: number;
      warning: number;
      info: number;
    };
    byCategory: {
      costAnomalies: number;
      resourceWaste: number;
      securityRisks: number;
      deploymentFailures: number;
    };
    totalPotentialSavings: number;
    totalPotentialSavingsFormatted: string;
    items: Array<{
      id: string;
      severity: 'critical' | 'warning' | 'info';
      category: string;
      title: string;
      description: string;
      detectedAt: string;
      resourceId?: string;
      resourceType?: string;
      estimatedMonthlyCost?: number;
      estimatedSavings?: number;
      estimatedSavingsFormatted?: string;
      autoFixable: boolean;
      fixCommand?: string;
    }>;
  };
  learningInsights: Array<{
    type: string;
    message: string;
    confidence: number;
    confidenceFormatted: string;
    source: string;
  }>;
  recommendations: string[];
  emailSubject: string;
  emailSummary: string;
}

export class ReportFormatter {
  static formatForPDF(
    result: CostAnalysisResult,
    deploymentId: string,
  ): PDFReportData {
    const reportId = `report-${Date.now()}`;
    const generatedAt = new Date().toISOString();

    const changeDirection = result.lastWeekCost.totalChangePercent > 0 ? 'up'
      : result.lastWeekCost.totalChangePercent < 0 ? 'down'
      : 'neutral';

    const trendDescriptions = {
      increasing: 'Costs are trending upward',
      decreasing: 'Costs are trending downward',
      stable: 'Costs are relatively stable',
    };

    const topServices = result.lastWeekCost.topServices.slice(0, 5).map(service => ({
      name: service.service,
      currentWeekCost: service.currentWeekCost,
      currentWeekFormatted: `$${service.currentWeekCost.toFixed(2)}`,
      changePercent: service.changePercent,
      changeFormatted: `${service.changePercent > 0 ? '+' : ''}${service.changePercent.toFixed(1)}%`,
      monthlyProjection: service.monthlyProjection,
      monthlyFormatted: `$${service.monthlyProjection.toFixed(2)}`,
    }));

    const redFlagItems = result.redFlags.map(flag => ({
      id: flag.id,
      severity: flag.severity,
      category: flag.category,
      title: flag.title,
      description: flag.description,
      detectedAt: flag.detectedAt,
      resourceId: flag.resourceId,
      resourceType: flag.resourceType,
      estimatedMonthlyCost: flag.estimatedMonthlyCost,
      estimatedSavings: flag.estimatedSavings,
      estimatedSavingsFormatted: flag.estimatedSavings
        ? `$${flag.estimatedSavings.toFixed(2)}/month`
        : undefined,
      autoFixable: flag.autoFixable,
      fixCommand: flag.fixCommand,
    }));

    const learningInsights = result.learningInsights.map(insight => ({
      type: insight.type,
      message: insight.message,
      confidence: insight.confidence,
      confidenceFormatted: `${(insight.confidence * 100).toFixed(1)}%`,
      source: insight.source,
    }));

    const recommendations = this.generateRecommendations(result);

    const emailSubject = this.generateEmailSubject(result);
    const emailSummary = this.generateEmailSummary(result);

    return {
      metadata: {
        reportId,
        generatedAt,
        deploymentId,
        billingPeriod: {
          start: result.lastWeekCost.billingPeriodStart,
          end: result.lastWeekCost.billingPeriodEnd,
        },
      },
      costSummary: {
        lastWeek: {
          total: result.lastWeekCost.totalCurrentWeek,
          formatted: `$${result.lastWeekCost.totalCurrentWeek.toFixed(2)}`,
        },
        previousWeek: {
          total: result.lastWeekCost.totalPreviousWeek,
          formatted: `$${result.lastWeekCost.totalPreviousWeek.toFixed(2)}`,
        },
        change: {
          amount: result.lastWeekCost.totalChangeAmount,
          percent: result.lastWeekCost.totalChangePercent,
          formatted: `${result.lastWeekCost.totalChangePercent > 0 ? '+' : ''}${result.lastWeekCost.totalChangePercent.toFixed(1)}%`,
          direction: changeDirection,
        },
      },
      projections: {
        nextWeek: {
          predicted: result.expectedNextWeekCost.predicted,
          formatted: `$${result.expectedNextWeekCost.predicted.toFixed(2)}`,
          confidenceInterval: {
            low: result.expectedNextWeekCost.confidenceInterval.low,
            high: result.expectedNextWeekCost.confidenceInterval.high,
            formatted: `$${result.expectedNextWeekCost.confidenceInterval.low.toFixed(2)} - $${result.expectedNextWeekCost.confidenceInterval.high.toFixed(2)}`,
          },
          methodology: result.expectedNextWeekCost.methodology,
        },
        monthly: {
          projected: result.expectedMonthlyCost.projected,
          formatted: `$${result.expectedMonthlyCost.projected.toFixed(2)}`,
          confidenceInterval: {
            low: result.expectedMonthlyCost.confidenceInterval.low,
            high: result.expectedMonthlyCost.confidenceInterval.high,
            formatted: `$${result.expectedMonthlyCost.confidenceInterval.low.toFixed(2)} - $${result.expectedMonthlyCost.confidenceInterval.high.toFixed(2)}`,
          },
          trend: result.expectedMonthlyCost.trendDirection,
          trendDescription: trendDescriptions[result.expectedMonthlyCost.trendDirection],
        },
      },
      topServices,
      redFlags: {
        total: result.redFlagSummary.total,
        summary: {
          critical: result.redFlagSummary.bySeverity.critical,
          warning: result.redFlagSummary.bySeverity.warning,
          info: result.redFlagSummary.bySeverity.info,
        },
        byCategory: {
          costAnomalies: result.redFlagSummary.byCategory.cost_anomaly,
          resourceWaste: result.redFlagSummary.byCategory.resource_waste,
          securityRisks: result.redFlagSummary.byCategory.security_risk,
          deploymentFailures: result.redFlagSummary.byCategory.deployment_failure,
        },
        totalPotentialSavings: result.redFlagSummary.totalPotentialSavings,
        totalPotentialSavingsFormatted: `$${result.redFlagSummary.totalPotentialSavings.toFixed(2)}/month`,
        items: redFlagItems,
      },
      learningInsights,
      recommendations,
      emailSubject,
      emailSummary,
    };
  }

  private static generateRecommendations(result: CostAnalysisResult): string[] {
    const recommendations: string[] = [];

    if (result.lastWeekCost.totalChangePercent > 20) {
      recommendations.push(
        `Your costs increased by ${result.lastWeekCost.totalChangePercent.toFixed(1)}% this week. Review your top services for unexpected usage.`
      );
    }

    if (result.expectedMonthlyCost.trendDirection === 'increasing') {
      recommendations.push(
        `Costs are trending upward. Consider implementing cost optimization strategies.`
      );
    }

    const criticalFlags = result.redFlags.filter(f => f.severity === 'critical');
    if (criticalFlags.length > 0) {
      recommendations.push(
        `${criticalFlags.length} critical issue${criticalFlags.length > 1 ? 's' : ''} detected. Address these immediately.`
      );
    }

    const autoFixable = result.redFlags.filter(f => f.autoFixable);
    if (autoFixable.length > 0) {
      recommendations.push(
        `${autoFixable.length} issue${autoFixable.length > 1 ? 's' : ''} can be automatically fixed. Reply to this email to approve.`
      );
    }

    if (result.redFlagSummary.totalPotentialSavings > 50) {
      recommendations.push(
        `Potential savings of $${result.redFlagSummary.totalPotentialSavings.toFixed(2)}/month identified. Review recommendations below.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Your deployment is running smoothly. Continue monitoring for changes.');
    }

    return recommendations;
  }

  private static generateEmailSubject(result: CostAnalysisResult): string {
    const cost = result.lastWeekCost.totalCurrentWeek.toFixed(2);
    const change = result.lastWeekCost.totalChangePercent;
    const trend = change > 0 ? '↑' : change < 0 ? '↓' : '→';

    if (result.redFlagSummary.bySeverity.critical > 0) {
      return `🚨 Weekly Cost Report: $${cost} ${trend} ${Math.abs(change).toFixed(1)}% - ${result.redFlagSummary.bySeverity.critical} Critical Issue${result.redFlagSummary.bySeverity.critical > 1 ? 's' : ''}`;
    }

    if (Math.abs(change) > 20) {
      return `⚠️ Weekly Cost Report: $${cost} ${trend} ${Math.abs(change).toFixed(1)}%`;
    }

    return `📊 Weekly Cost Report: $${cost} ${trend} ${Math.abs(change).toFixed(1)}%`;
  }

  private static generateEmailSummary(result: CostAnalysisResult): string {
    const lines: string[] = [];

    lines.push(`Your AWS costs for the week ending ${result.lastWeekCost.billingPeriodEnd}:`);
    lines.push('');
    lines.push(`Last Week: $${result.lastWeekCost.totalCurrentWeek.toFixed(2)}`);
    lines.push(`Change: ${result.lastWeekCost.totalChangePercent > 0 ? '+' : ''}${result.lastWeekCost.totalChangePercent.toFixed(1)}%`);
    lines.push(`Monthly Projection: $${result.expectedMonthlyCost.projected.toFixed(2)}`);
    lines.push('');

    if (result.redFlags.length > 0) {
      lines.push(`Issues Detected: ${result.redFlags.length}`);
      lines.push(`  Critical: ${result.redFlagSummary.bySeverity.critical}`);
      lines.push(`  Warnings: ${result.redFlagSummary.bySeverity.warning}`);
      lines.push('');
    }

    if (result.redFlagSummary.totalPotentialSavings > 0) {
      lines.push(`Potential Savings: $${result.redFlagSummary.totalPotentialSavings.toFixed(2)}/month`);
      lines.push('');
    }

    if (result.redFlags.length > 0) {
      lines.push('Top Issues:');
      result.redFlags.slice(0, 3).forEach((flag, i) => {
        lines.push(`  ${i + 1}. ${flag.title}`);
      });
      lines.push('');
    }

    lines.push('Full report attached. Reply to this email to take action.');

    return lines.join('\n');
  }
}
