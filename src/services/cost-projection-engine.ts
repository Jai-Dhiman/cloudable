import type { CostSummary } from '../types/cost-monitor.js';
import { HyperspellClient } from '../integrations/hyperspell.js';

export interface CostPrediction {
  predicted: number;
  confidenceInterval: { low: number; high: number };
  methodology: 'linear_trend' | 'moving_average' | 'hyperspell_pattern' | 'simple';
}

export interface MonthlyCostProjection {
  projected: number;
  confidenceInterval: { low: number; high: number };
  trendDirection: 'increasing' | 'decreasing' | 'stable';
}

export class CostProjectionEngine {
  private hyperspell: HyperspellClient;

  constructor(hyperspellApiKey?: string) {
    this.hyperspell = new HyperspellClient(hyperspellApiKey);
  }

  async predictNextWeek(historicalData: CostSummary[]): Promise<CostPrediction> {
    if (!historicalData || historicalData.length === 0) {
      throw new Error('Historical data is required for cost prediction');
    }

    if (historicalData.length === 1) {
      return this.simplePrediction(historicalData[0].totalCurrentWeek);
    }

    if (historicalData.length === 2 || historicalData.length === 3) {
      return this.movingAveragePrediction(historicalData);
    }

    return this.linearTrendPrediction(historicalData);
  }

  async projectMonthlyCost(
    currentWeekCost: number,
    historicalData: CostSummary[],
  ): Promise<MonthlyCostProjection> {
    const simpleProjection = currentWeekCost * 4.33;

    if (!historicalData || historicalData.length < 2) {
      return {
        projected: Math.round(simpleProjection * 100) / 100,
        confidenceInterval: {
          low: Math.round(simpleProjection * 0.9 * 100) / 100,
          high: Math.round(simpleProjection * 1.1 * 100) / 100,
        },
        trendDirection: 'stable',
      };
    }

    const growthRate = this.calculateGrowthRate(historicalData);
    const trendDirection = this.determineTrendDirection(growthRate);

    const trendAdjustedProjection = simpleProjection * (1 + growthRate);

    const adjustedProjection = await this.adjustFromLearning(
      trendAdjustedProjection,
      historicalData,
    );

    const confidenceRange = this.calculateConfidenceRange(
      adjustedProjection,
      historicalData,
    );

    return {
      projected: Math.round(adjustedProjection * 100) / 100,
      confidenceInterval: {
        low: Math.round((adjustedProjection - confidenceRange) * 100) / 100,
        high: Math.round((adjustedProjection + confidenceRange) * 100) / 100,
      },
      trendDirection,
    };
  }

  async adjustPredictionFromLearning(
    prediction: number,
    service: string,
    resourceType: string,
  ): Promise<number> {
    try {
      await this.hyperspell.initialize();
      const accuracy = await this.hyperspell.getCostEstimateAccuracy(
        service,
        resourceType,
      );

      if (accuracy.sampleSize === 0) {
        return prediction;
      }

      const adjustmentFactor = 1 + (accuracy.avgVariancePercent / 100);
      return prediction * adjustmentFactor;
    } catch (error) {
      console.error('Error adjusting prediction from Hyperspell:', error);
      return prediction;
    }
  }

  private simplePrediction(currentCost: number): CostPrediction {
    return {
      predicted: Math.round(currentCost * 100) / 100,
      confidenceInterval: {
        low: Math.round(currentCost * 0.85 * 100) / 100,
        high: Math.round(currentCost * 1.15 * 100) / 100,
      },
      methodology: 'simple',
    };
  }

  private movingAveragePrediction(historicalData: CostSummary[]): CostPrediction {
    const weights = historicalData.length === 2
      ? [0.6, 0.4]
      : [0.5, 0.3, 0.2];

    let weightedSum = 0;
    for (let i = 0; i < historicalData.length; i++) {
      const weight = weights[i] || 0;
      weightedSum += historicalData[historicalData.length - 1 - i].totalCurrentWeek * weight;
    }

    const predicted = weightedSum;

    const avgCost = historicalData.reduce((sum, data) => sum + data.totalCurrentWeek, 0) / historicalData.length;
    const variance = historicalData.reduce(
      (sum, data) => sum + Math.pow(data.totalCurrentWeek - avgCost, 2),
      0,
    ) / historicalData.length;
    const stdDev = Math.sqrt(variance);

    return {
      predicted: Math.round(predicted * 100) / 100,
      confidenceInterval: {
        low: Math.round((predicted - stdDev) * 100) / 100,
        high: Math.round((predicted + stdDev) * 100) / 100,
      },
      methodology: 'moving_average',
    };
  }

  private linearTrendPrediction(historicalData: CostSummary[]): CostPrediction {
    const n = historicalData.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = historicalData.map(data => data.totalCurrentWeek);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predicted = slope * n + intercept;

    const avgCost = sumY / n;
    const variance = yValues.reduce(
      (sum, y) => sum + Math.pow(y - avgCost, 2),
      0,
    ) / n;
    const stdDev = Math.sqrt(variance);

    return {
      predicted: Math.round(Math.max(0, predicted) * 100) / 100,
      confidenceInterval: {
        low: Math.round(Math.max(0, predicted - stdDev) * 100) / 100,
        high: Math.round((predicted + stdDev) * 100) / 100,
      },
      methodology: 'linear_trend',
    };
  }

  private calculateGrowthRate(historicalData: CostSummary[]): number {
    if (historicalData.length < 2) {
      return 0;
    }

    const oldest = historicalData[0].totalCurrentWeek;
    const newest = historicalData[historicalData.length - 1].totalCurrentWeek;

    if (oldest === 0) {
      return 0;
    }

    const totalGrowth = (newest - oldest) / oldest;
    const periods = historicalData.length - 1;

    return totalGrowth / periods;
  }

  private determineTrendDirection(
    growthRate: number,
  ): 'increasing' | 'decreasing' | 'stable' {
    const threshold = 0.05;

    if (growthRate > threshold) {
      return 'increasing';
    }

    if (growthRate < -threshold) {
      return 'decreasing';
    }

    return 'stable';
  }

  private async adjustFromLearning(
    projection: number,
    historicalData: CostSummary[],
  ): Promise<number> {
    try {
      await this.hyperspell.initialize();

      const topServices = historicalData[historicalData.length - 1]?.topServices || [];

      if (topServices.length === 0) {
        return projection;
      }

      let totalAdjustment = 0;
      let totalWeight = 0;

      for (const service of topServices.slice(0, 3)) {
        const accuracy = await this.hyperspell.getCostEstimateAccuracy(
          service.service,
          service.service,
        );

        if (accuracy.sampleSize > 0) {
          const weight = service.currentWeekCost;
          const adjustment = accuracy.avgVariancePercent / 100;

          totalAdjustment += adjustment * weight;
          totalWeight += weight;
        }
      }

      if (totalWeight === 0) {
        return projection;
      }

      const weightedAdjustment = totalAdjustment / totalWeight;
      return projection * (1 + weightedAdjustment);
    } catch (error) {
      console.error('Error adjusting projection from Hyperspell learning:', error);
      return projection;
    }
  }

  private calculateConfidenceRange(
    projection: number,
    historicalData: CostSummary[],
  ): number {
    if (historicalData.length < 2) {
      return projection * 0.1;
    }

    const costs = historicalData.map(data => data.totalCurrentWeek);
    const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;

    const variance = costs.reduce(
      (sum, cost) => sum + Math.pow(cost - avgCost, 2),
      0,
    ) / costs.length;

    const stdDev = Math.sqrt(variance);

    return stdDev;
  }
}
