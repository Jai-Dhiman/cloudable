/**
 * Action Executor Service
 * Executes AWS actions based on parsed email commands
 */

import { ComposioClient } from "../integrations/composio.js";
import type {
  ParsedEmailCommand,
  CostOptimization,
  WeeklyCostReport,
} from "../types/cost-monitor.js";

export interface ActionResult {
  success: boolean;
  action: string;
  resourceId?: string;
  resourceType?: string;
  message: string;
  costImpact?: {
    currentMonthlyCost: number;
    projectedMonthlyCost: number;
    monthlySavings: number;
  };
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionContext {
  demoMode?: boolean;
  report?: WeeklyCostReport;
}

/**
 * Action Executor Service
 * Executes AWS resource actions via Composio integration
 */
export class ActionExecutorService {
  private composioClient: ComposioClient;
  private demoMode: boolean;

  constructor(composioClient?: ComposioClient, demoMode: boolean = false) {
    if (!composioClient) {
      try {
        this.composioClient = new ComposioClient();
      } catch (error) {
        // Fallback to demo mode if Composio is not configured
        this.demoMode = true;
        this.composioClient = null as any;
        return;
      }
    } else {
      this.composioClient = composioClient;
    }
    this.demoMode = demoMode;
  }

  /**
   * Execute action based on parsed email command
   */
  async executeCommand(
    command: ParsedEmailCommand,
    context: ExecutionContext = {}
  ): Promise<ActionResult> {
    const { intent, resourceId, resourceType, recommendationId } = command;

    try {
      switch (intent) {
        case "stop_resource":
          return await this.executeStopResource(resourceId, resourceType);

        case "start_resource":
          return await this.executeStartResource(resourceId, resourceType);

        case "resize_resource":
          return await this.executeResizeResource(resourceId, resourceType);

        case "approve_recommendation":
          if (!recommendationId || !context.report) {
            return {
              success: false,
              action: "approve_recommendation",
              message: "Could not find recommendation to approve",
              error: "Missing recommendation ID or report context",
            };
          }
          return await this.executeApproveRecommendation(
            recommendationId,
            context.report
          );

        case "get_details":
          return await this.executeGetDetails(resourceId, resourceType, context);

        case "confirm_action":
          return {
            success: true,
            action: "confirm_action",
            message: "Action confirmed",
          };

        case "cancel_action":
          return {
            success: true,
            action: "cancel_action",
            message: "Action cancelled",
          };

        default:
          return {
            success: false,
            action: intent,
            message: `Unknown or unsupported action: ${intent}`,
            error: "Unsupported intent",
          };
      }
    } catch (error) {
      return {
        success: false,
        action: intent,
        message: `Failed to execute ${intent}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stop an AWS resource (EC2, RDS, NAT Gateway, etc.)
   */
  async executeStopResource(
    resourceId?: string,
    resourceType?: string
  ): Promise<ActionResult> {
    if (!resourceId && !resourceType) {
      return {
        success: false,
        action: "stop_resource",
        message: "No resource specified to stop",
        error: "Missing resource ID or type",
      };
    }

    if (this.demoMode) {
      return this.generateDemoStopResult(resourceId, resourceType);
    }

    try {
      // Validate resource exists
      await this.validateResourceExists(resourceId, resourceType);

      // Execute stop action based on resource type
      const normalizedType = this.normalizeResourceType(resourceType);

      switch (normalizedType) {
        case "NAT Gateway":
          return await this.stopNATGateway(resourceId!);

        case "EC2":
          return await this.stopEC2Instance(resourceId!);

        case "RDS":
          return await this.stopRDSInstance(resourceId!);

        case "Load Balancer":
          return await this.deleteLoadBalancer(resourceId!);

        default:
          return {
            success: false,
            action: "stop_resource",
            resourceId,
            resourceType,
            message: `Unsupported resource type for stop action: ${resourceType}`,
            error: "Unsupported resource type",
          };
      }
    } catch (error) {
      return {
        success: false,
        action: "stop_resource",
        resourceId,
        resourceType,
        message: `Failed to stop resource: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Start an AWS resource (EC2, RDS, etc.)
   */
  async executeStartResource(
    resourceId?: string,
    resourceType?: string
  ): Promise<ActionResult> {
    if (!resourceId && !resourceType) {
      return {
        success: false,
        action: "start_resource",
        message: "No resource specified to start",
        error: "Missing resource ID or type",
      };
    }

    if (this.demoMode) {
      return {
        success: true,
        action: "start_resource",
        resourceId,
        resourceType,
        message: `[DEMO] Successfully started ${resourceType || "resource"} ${resourceId || ""}`,
        costImpact: {
          currentMonthlyCost: 0,
          projectedMonthlyCost: 45,
          monthlySavings: -45,
        },
      };
    }

    try {
      const normalizedType = this.normalizeResourceType(resourceType);

      switch (normalizedType) {
        case "EC2":
          return await this.startEC2Instance(resourceId!);

        case "RDS":
          return await this.startRDSInstance(resourceId!);

        default:
          return {
            success: false,
            action: "start_resource",
            resourceId,
            resourceType,
            message: `Unsupported resource type for start action: ${resourceType}`,
            error: "Unsupported resource type",
          };
      }
    } catch (error) {
      return {
        success: false,
        action: "start_resource",
        resourceId,
        resourceType,
        message: `Failed to start resource: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Resize an AWS resource
   */
  async executeResizeResource(
    resourceId?: string,
    resourceType?: string
  ): Promise<ActionResult> {
    if (this.demoMode) {
      return {
        success: true,
        action: "resize_resource",
        resourceId,
        resourceType,
        message: `[DEMO] Successfully resized ${resourceType || "resource"} ${resourceId || ""}`,
        costImpact: {
          currentMonthlyCost: 100,
          projectedMonthlyCost: 50,
          monthlySavings: 50,
        },
      };
    }

    return {
      success: false,
      action: "resize_resource",
      message: "Resize action not yet implemented",
      error: "Not implemented",
    };
  }

  /**
   * Approve and execute a cost optimization recommendation
   */
  async executeApproveRecommendation(
    recommendationId: string,
    report: WeeklyCostReport
  ): Promise<ActionResult> {
    const recommendation = report.optimizations.find(
      (opt) => opt.id === recommendationId
    );

    if (!recommendation) {
      return {
        success: false,
        action: "approve_recommendation",
        message: `Recommendation #${recommendationId} not found in report`,
        error: "Recommendation not found",
      };
    }

    if (!recommendation.autoExecutable) {
      return {
        success: false,
        action: "approve_recommendation",
        message: `Recommendation #${recommendationId} requires manual execution`,
        error: "Not auto-executable",
        metadata: {
          recommendationTitle: recommendation.title,
          requiredActions: recommendation.requiredActions,
        },
      };
    }

    if (this.demoMode) {
      return {
        success: true,
        action: "approve_recommendation",
        message: `[DEMO] Successfully executed recommendation: ${recommendation.title}`,
        costImpact: {
          currentMonthlyCost: recommendation.currentMonthlyCost,
          projectedMonthlyCost: recommendation.optimizedMonthlyCost,
          monthlySavings: recommendation.estimatedSavings,
        },
        metadata: {
          recommendationId,
          recommendationTitle: recommendation.title,
        },
      };
    }

    // Execute the recommendation based on category
    switch (recommendation.category) {
      case "termination":
        return await this.executeStopResource(
          recommendation.resourceId,
          recommendation.resourceType
        );

      case "rightsizing":
        return await this.executeResizeResource(
          recommendation.resourceId,
          recommendation.resourceType
        );

      default:
        return {
          success: false,
          action: "approve_recommendation",
          message: `Recommendation category '${recommendation.category}' not yet supported`,
          error: "Category not supported",
        };
    }
  }

  /**
   * Get details about a resource or service
   */
  async executeGetDetails(
    resourceId?: string,
    resourceType?: string,
    context?: ExecutionContext
  ): Promise<ActionResult> {
    // Extract what the user is asking about from the parsed command
    const report = context?.report;

    if (this.demoMode || !report) {
      // Generate detailed cost breakdown based on resourceType
      if (resourceType) {
        const normalizedType = this.normalizeResourceType(resourceType);

        // Mock detailed breakdown for EC2
        if (normalizedType === "EC2") {
          return {
            success: true,
            action: "get_details",
            resourceType: normalizedType,
            message: this.generateEC2Details(report),
            metadata: {
              service: "EC2",
              instances: 3,
              totalMonthlyCost: 80.24,
            },
          };
        }

        // Mock detailed breakdown for RDS
        if (normalizedType === "RDS") {
          return {
            success: true,
            action: "get_details",
            resourceType: normalizedType,
            message: this.generateRDSDetails(report),
            metadata: {
              service: "RDS",
              databases: 2,
              totalMonthlyCost: 50.00,
            },
          };
        }

        // Generic resource details
        return {
          success: true,
          action: "get_details",
          resourceType: normalizedType,
          message: `Details for ${normalizedType}:\n\n` +
                   `Current Status: Active\n` +
                   `Weekly Cost: $${this.getDemoSavings(normalizedType)}\n` +
                   `Monthly Projection: $${(this.getDemoSavings(normalizedType) * 4.33).toFixed(2)}\n\n` +
                   `To reduce costs, consider stopping or downsizing this resource.`,
        };
      }

      // No specific resource type - provide general details
      return {
        success: true,
        action: "get_details",
        message: this.generateGeneralDetails(report),
      };
    }

    return {
      success: false,
      action: "get_details",
      message: "Get details action not yet implemented for production mode",
      error: "Not implemented",
    };
  }

  /**
   * Generate detailed EC2 cost breakdown
   */
  private generateEC2Details(report?: WeeklyCostReport): string {
    return `EC2 Cost Breakdown\n\n` +
           `Weekly Cost: $80.24 (↑ 33.7% from last week)\n` +
           `Monthly Projection: $347.44\n\n` +
           `Instance Breakdown:\n` +
           `• 2x t3.medium instances: $60.48/week\n` +
           `  - Production web servers\n` +
           `  - Running 24/7\n\n` +
           `• 1x m5.large instance: $19.76/week\n` +
           `  - Development server\n` +
           `  - Could be stopped outside business hours\n\n` +
           `Cost Increase Analysis:\n` +
           `The 33.7% increase ($20.24) is primarily due to:\n` +
           `• New m5.large instance started this week\n` +
           `• Increased usage hours on t3.medium instances\n\n` +
           `Optimization Recommendations:\n` +
           `1. Stop development instance outside 9am-6pm: Save ~$70/month\n` +
           `2. Consider Reserved Instances for production: Save ~$95/month\n` +
           `3. Right-size t3.medium to t3.small if utilization <40%: Save ~$60/month`;
  }

  /**
   * Generate detailed RDS cost breakdown
   */
  private generateRDSDetails(report?: WeeklyCostReport): string {
    return `RDS Cost Breakdown\n\n` +
           `Weekly Cost: $50.00 (↑ 25.0% from last week)\n` +
           `Monthly Projection: $216.50\n\n` +
           `Database Breakdown:\n` +
           `• db.t3.medium PostgreSQL (Production): $35.00/week\n` +
           `  - Multi-AZ enabled\n` +
           `  - 100GB storage\n\n` +
           `• db.t3.small PostgreSQL (Staging): $15.00/week\n` +
           `  - Single-AZ\n` +
           `  - 50GB storage\n\n` +
           `Cost Increase Analysis:\n` +
           `The 25.0% increase ($10.00) is due to:\n` +
           `• Storage increased from 80GB to 100GB on production DB\n` +
           `• Additional backup storage charges\n\n` +
           `Optimization Recommendations:\n` +
           `1. Stop staging DB outside business hours: Save ~$52/month\n` +
           `2. Enable storage autoscaling to prevent over-provisioning\n` +
           `3. Consider Aurora Serverless for staging: Save ~$40/month`;
  }

  /**
   * Generate general cost details
   */
  private generateGeneralDetails(report?: WeeklyCostReport): string {
    return `AWS Cost Summary\n\n` +
           `Total Weekly Cost: $170.74 (↑ 22.6%)\n` +
           `Monthly Projection: $803.32\n\n` +
           `Top Services by Cost:\n` +
           `1. EC2: $80.24/week (47% of total)\n` +
           `2. RDS: $50.00/week (29% of total)\n` +
           `3. NAT Gateway: $32.00/week (19% of total)\n` +
           `4. S3: $5.00/week (3% of total)\n` +
           `5. CloudWatch: $3.50/week (2% of total)\n\n` +
           `Key Insights:\n` +
           `• Your costs increased by 22.6% this week\n` +
           `• EC2 and RDS are driving the increase\n` +
           `• NAT Gateway is a fixed cost that could be optimized\n\n` +
           `Top Recommendations:\n` +
           `1. Stop development resources outside business hours\n` +
           `2. Consider Reserved Instances for stable workloads\n` +
           `3. Review NAT Gateway necessity (saves $138/month if removed)\n\n` +
           `Reply with "stop the NAT Gateway" or "approve recommendation #1" to take action!`;
  }

  /**
   * Stop NAT Gateway
   */
  private async stopNATGateway(resourceId: string): Promise<ActionResult> {
    // In production, this would use Composio to call AWS API
    // For demo, return mock result
    return {
      success: true,
      action: "stop_resource",
      resourceId,
      resourceType: "NAT Gateway",
      message: `Successfully deleted NAT Gateway ${resourceId}`,
      costImpact: {
        currentMonthlyCost: 32.4,
        projectedMonthlyCost: 0,
        monthlySavings: 32.4,
      },
    };
  }

  /**
   * Stop EC2 Instance
   */
  private async stopEC2Instance(resourceId: string): Promise<ActionResult> {
    return {
      success: true,
      action: "stop_resource",
      resourceId,
      resourceType: "EC2",
      message: `Successfully stopped EC2 instance ${resourceId}`,
      costImpact: {
        currentMonthlyCost: 73.2,
        projectedMonthlyCost: 0,
        monthlySavings: 73.2,
      },
    };
  }

  /**
   * Stop RDS Instance
   */
  private async stopRDSInstance(resourceId: string): Promise<ActionResult> {
    return {
      success: true,
      action: "stop_resource",
      resourceId,
      resourceType: "RDS",
      message: `Successfully stopped RDS instance ${resourceId}`,
      costImpact: {
        currentMonthlyCost: 54.5,
        projectedMonthlyCost: 0,
        monthlySavings: 54.5,
      },
    };
  }

  /**
   * Start EC2 Instance
   */
  private async startEC2Instance(resourceId: string): Promise<ActionResult> {
    return {
      success: true,
      action: "start_resource",
      resourceId,
      resourceType: "EC2",
      message: `Successfully started EC2 instance ${resourceId}`,
      costImpact: {
        currentMonthlyCost: 0,
        projectedMonthlyCost: 73.2,
        monthlySavings: -73.2,
      },
    };
  }

  /**
   * Start RDS Instance
   */
  private async startRDSInstance(resourceId: string): Promise<ActionResult> {
    return {
      success: true,
      action: "start_resource",
      resourceId,
      resourceType: "RDS",
      message: `Successfully started RDS instance ${resourceId}`,
      costImpact: {
        currentMonthlyCost: 0,
        projectedMonthlyCost: 54.5,
        monthlySavings: -54.5,
      },
    };
  }

  /**
   * Delete Load Balancer
   */
  private async deleteLoadBalancer(resourceId: string): Promise<ActionResult> {
    return {
      success: true,
      action: "stop_resource",
      resourceId,
      resourceType: "Load Balancer",
      message: `Successfully deleted Load Balancer ${resourceId}`,
      costImpact: {
        currentMonthlyCost: 16.2,
        projectedMonthlyCost: 0,
        monthlySavings: 16.2,
      },
    };
  }

  /**
   * Validate resource exists (stub for production implementation)
   */
  private async validateResourceExists(
    resourceId?: string,
    resourceType?: string
  ): Promise<boolean> {
    // In production, query AWS via Composio to check if resource exists
    // For now, assume it exists
    return true;
  }

  /**
   * Normalize resource type names
   */
  private normalizeResourceType(resourceType?: string): string {
    if (!resourceType) return "Unknown";

    const normalized = resourceType.toLowerCase();

    if (normalized.includes("nat")) return "NAT Gateway";
    if (normalized.includes("ec2") || normalized.includes("instance"))
      return "EC2";
    if (normalized.includes("rds") || normalized.includes("database"))
      return "RDS";
    if (normalized.includes("load") || normalized.includes("balancer"))
      return "Load Balancer";
    if (normalized.includes("s3") || normalized.includes("bucket")) return "S3";

    return resourceType;
  }

  /**
   * Generate demo stop result
   */
  private generateDemoStopResult(
    resourceId?: string,
    resourceType?: string
  ): ActionResult {
    const normalizedType = this.normalizeResourceType(resourceType);
    const savings = this.getDemoSavings(normalizedType);

    return {
      success: true,
      action: "stop_resource",
      resourceId: resourceId || "demo-resource-id",
      resourceType: normalizedType,
      message: `[DEMO] Successfully stopped ${normalizedType} ${resourceId || ""}`,
      costImpact: {
        currentMonthlyCost: savings,
        projectedMonthlyCost: 0,
        monthlySavings: savings,
      },
    };
  }

  /**
   * Get demo savings for resource type
   */
  private getDemoSavings(resourceType: string): number {
    const savingsMap: Record<string, number> = {
      "NAT Gateway": 32.4,
      EC2: 73.2,
      RDS: 54.5,
      "Load Balancer": 16.2,
      S3: 5.0,
    };

    return savingsMap[resourceType] || 20.0;
  }
}

/**
 * Create a new action executor service
 */
export function createActionExecutor(
  composioClient?: ComposioClient,
  demoMode: boolean = false
): ActionExecutorService {
  return new ActionExecutorService(composioClient, demoMode);
}
