import { CostAnomalyDetector } from '../detectors/cost-anomaly-detector.js';
import { ResourceWasteDetector } from '../detectors/resource-waste-detector.js';
import { SecurityRiskDetector } from '../detectors/security-risk-detector.js';
import { DeploymentFailureDetector } from '../detectors/deployment-failure-detector.js';
import type {
  RedFlag,
  RedFlagCategory,
  RedFlagDetectorInput,
  CostSummary,
  AWSResourceInventory,
} from '../types/cost-monitor.js';

export interface RedFlagSummary {
  total: number;
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  byCategory: {
    cost_anomaly: number;
    resource_waste: number;
    security_risk: number;
    deployment_failure: number;
  };
  totalPotentialSavings: number;
}

export interface RedFlagAggregatorResult {
  redFlags: RedFlag[];
  summary: RedFlagSummary;
}

export class RedFlagAggregator {
  private costAnomalyDetector: CostAnomalyDetector;
  private resourceWasteDetector: ResourceWasteDetector;
  private securityRiskDetector: SecurityRiskDetector;
  private deploymentFailureDetector: DeploymentFailureDetector;
  private demoMode: boolean;

  constructor(region: string = 'us-east-1', hyperspellApiKey?: string, demoMode: boolean = false) {
    this.costAnomalyDetector = new CostAnomalyDetector();
    this.resourceWasteDetector = new ResourceWasteDetector(undefined, region);
    this.securityRiskDetector = new SecurityRiskDetector(undefined, region);
    this.deploymentFailureDetector = new DeploymentFailureDetector(
      undefined,
      region,
      hyperspellApiKey,
    );
    this.demoMode = demoMode;
  }

  async detectAllRedFlags(input: {
    deploymentId: string;
    costData: CostSummary;
    awsResources: AWSResourceInventory;
    historicalData?: CostSummary[];
  }): Promise<RedFlagAggregatorResult> {
    const detectorInput: RedFlagDetectorInput = {
      deploymentId: input.deploymentId,
      costData: input.costData,
      awsResources: input.awsResources,
      historicalData: input.historicalData,
    };

    let costAnomalies, resourceWaste, securityRisks, deploymentFailures;

    if (this.demoMode) {
      costAnomalies = await this.costAnomalyDetector.detect(detectorInput);
      resourceWaste = { redFlags: [], detectionMetadata: { detectorId: 'resource-waste-detector', detectorVersion: '1.0.0', executionTimeMs: 0, resourcesScanned: 0 } };
      securityRisks = { redFlags: [], detectionMetadata: { detectorId: 'security-risk-detector', detectorVersion: '1.0.0', executionTimeMs: 0, resourcesScanned: 0 } };
      deploymentFailures = { redFlags: [], detectionMetadata: { detectorId: 'deployment-failure-detector', detectorVersion: '1.0.0', executionTimeMs: 0, resourcesScanned: 0 } };
    } else {
      [costAnomalies, resourceWaste, securityRisks, deploymentFailures] =
        await Promise.all([
          this.costAnomalyDetector.detect(detectorInput),
          this.resourceWasteDetector.detect(detectorInput),
          this.securityRiskDetector.detect(detectorInput),
          this.deploymentFailureDetector.detect(detectorInput),
        ]);
    }

    const allRedFlags = [
      ...costAnomalies.redFlags,
      ...resourceWaste.redFlags,
      ...securityRisks.redFlags,
      ...deploymentFailures.redFlags,
    ];

    const sortedRedFlags = this.sortBySeverity(allRedFlags);

    const summary = this.calculateSummary(sortedRedFlags);

    return {
      redFlags: sortedRedFlags,
      summary,
    };
  }

  private sortBySeverity(flags: RedFlag[]): RedFlag[] {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  private calculateSummary(flags: RedFlag[]): RedFlagSummary {
    const summary: RedFlagSummary = {
      total: flags.length,
      bySeverity: {
        critical: 0,
        warning: 0,
        info: 0,
      },
      byCategory: {
        cost_anomaly: 0,
        resource_waste: 0,
        security_risk: 0,
        deployment_failure: 0,
      },
      totalPotentialSavings: 0,
    };

    for (const flag of flags) {
      summary.bySeverity[flag.severity]++;

      summary.byCategory[flag.category]++;

      if (flag.estimatedSavings) {
        summary.totalPotentialSavings += flag.estimatedSavings;
      }
    }

    summary.totalPotentialSavings = Math.round(summary.totalPotentialSavings * 100) / 100;

    return summary;
  }

  async detectCostAnomalies(input: RedFlagDetectorInput): Promise<RedFlag[]> {
    const result = await this.costAnomalyDetector.detect(input);
    return result.redFlags;
  }

  async detectResourceWaste(input: RedFlagDetectorInput): Promise<RedFlag[]> {
    const result = await this.resourceWasteDetector.detect(input);
    return result.redFlags;
  }

  async detectSecurityRisks(input: RedFlagDetectorInput): Promise<RedFlag[]> {
    const result = await this.securityRiskDetector.detect(input);
    return result.redFlags;
  }

  async detectDeploymentFailures(input: RedFlagDetectorInput): Promise<RedFlag[]> {
    const result = await this.deploymentFailureDetector.detect(input);
    return result.redFlags;
  }
}
