/**
 * Cost Monitor Agent Types
 * TypeScript interfaces for the human-in-the-loop feedback engine
 */

// ============================================
// Red Flag Detection Types
// ============================================

export type RedFlagSeverity = 'critical' | 'warning' | 'info';

export type RedFlagCategory =
  | 'cost_anomaly'
  | 'resource_waste'
  | 'security_risk'
  | 'deployment_failure';

export interface RedFlag {
  id: string;
  category: RedFlagCategory;
  severity: RedFlagSeverity;
  title: string;
  description: string;
  detectedAt: string; // ISO timestamp
  resourceId?: string; // AWS resource ID (e.g., i-123, sg-456)
  resourceType?: string; // EC2, RDS, NAT Gateway, etc.
  estimatedMonthlyCost?: number;
  estimatedSavings?: number;
  autoFixable: boolean;
  fixCommand?: string; // CLI command or action to fix
  metadata: Record<string, unknown>;
}

// ============================================
// Cost Data Types
// ============================================

export interface CostBreakdown {
  service: string; // EC2, RDS, S3, etc.
  currentWeekCost: number;
  previousWeekCost: number;
  changePercent: number;
  changeAmount: number;
  monthlyProjection: number;
}

export interface CostSummary {
  totalCurrentWeek: number;
  totalPreviousWeek: number;
  totalChangePercent: number;
  totalChangeAmount: number;
  monthlyProjection: number;
  budgetLimit?: number;
  budgetRemaining?: number;
  topServices: CostBreakdown[];
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

// ============================================
// Cost Optimization Types
// ============================================

export interface CostOptimization {
  id: string;
  title: string;
  description: string;
  category: 'rightsizing' | 'termination' | 'scheduling' | 'migration' | 'configuration';
  resourceId: string;
  resourceType: string;
  currentMonthlyCost: number;
  optimizedMonthlyCost: number;
  estimatedSavings: number;
  savingsPercent: number;
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  autoExecutable: boolean;
  requiredActions: string[];
  confidenceScore: number; // 0-1, based on Hyperspell learning
  historicalAcceptanceRate?: number; // From Hyperspell memory
}

// ============================================
// Email Report Types
// ============================================

export interface WeeklyCostReport {
  reportId: string;
  generatedAt: string;
  weekStartDate: string;
  weekEndDate: string;
  costSummary: CostSummary;
  redFlags: RedFlag[];
  optimizations: CostOptimization[];
  learningInsights: string[]; // Insights from Hyperspell
  deploymentId?: string;
}

// ============================================
// Email Command Types
// ============================================

export type EmailCommandIntent =
  | 'approve_recommendation'
  | 'reject_recommendation'
  | 'stop_resource'
  | 'start_resource'
  | 'resize_resource'
  | 'get_details'
  | 'confirm_action'
  | 'cancel_action'
  | 'unknown';

export interface ParsedEmailCommand {
  intent: EmailCommandIntent;
  confidence: number; // 0-1
  resourceId?: string;
  resourceType?: string;
  recommendationId?: string;
  rawCommand: string;
  extractedEntities: {
    resources?: string[];
    actions?: string[];
    amounts?: number[];
  };
  requiresConfirmation: boolean;
}

export interface EmailCommandContext {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  inReplyTo?: string;
  relatedReportId?: string;
}

// ============================================
// Hyperspell Memory Types
// ============================================

export interface UserDecisionMemory {
  id: string;
  timestamp: string;
  recommendationId: string;
  recommendation: CostOptimization;
  action: 'accepted' | 'rejected' | 'deferred';
  userEmail: string;
  context: {
    deploymentId?: string;
    framework?: string;
    services?: string[];
    costAtDecision: number;
  };
  reasoning?: string; // Optional user-provided reason
}

export interface DeploymentPatternMemory {
  id: string;
  timestamp: string;
  deploymentId: string;
  framework: string; // Next.js, Django, etc.
  services: string[]; // RDS, S3, etc.
  region: string;
  configuration: {
    instanceTypes: Record<string, string>; // service -> instance type
    storageGb: Record<string, number>;
    redundancy: 'single-az' | 'multi-az';
    autoScaling: boolean;
  };
  success: boolean;
  costEstimate: number;
  costActual?: number;
  performanceMetrics?: {
    deploymentTimeMinutes: number;
    uptimePercent?: number;
    avgResponseTimeMs?: number;
  };
  userSatisfaction?: number; // 1-5 rating
}

export interface CostEstimateMemory {
  id: string;
  timestamp: string;
  deploymentId: string;
  service: string; // EC2, RDS, etc.
  resourceType: string; // t3.medium, db.t3.small, etc.
  estimatedMonthlyCost: number;
  actualMonthlyCost?: number;
  variancePercent?: number;
  varianceAmount?: number;
  estimationMethod: 'aws_calculator' | 'historical_average' | 'ml_prediction';
  context: {
    region: string;
    usagePattern?: string;
    dataVolumeGb?: number;
  };
}

export interface ErrorResolutionMemory {
  id: string;
  timestamp: string;
  errorPattern: string; // e.g., "InsufficientCapacity in us-east-1a"
  errorType: string; // AWS error code
  service: string;
  resolutionSteps: string[];
  resolutionSuccessful: boolean;
  timesToResolution: number; // How many times this solution worked
  lastUsed: string;
  successRate: number; // 0-1
  context: {
    region?: string;
    instanceType?: string;
    availabilityZone?: string;
  };
  relatedErrors?: string[]; // Similar error patterns
}

// ============================================
// Agent Workflow Types
// ============================================

export interface CostMonitorAgentInput {
  deploymentId?: string;
  forceRefresh?: boolean; // Ignore cache, fetch fresh data
  dateRangeStart?: string;
  dateRangeEnd?: string;
  includeProjections?: boolean;
}

export interface CostMonitorAgentOutput {
  report: WeeklyCostReport;
  emailSent: boolean;
  emailThreadId?: string;
  hyperspellUpdated: boolean;
  nextScheduledRun?: string;
}

export interface RedFlagDetectorInput {
  deploymentId: string;
  costData: CostSummary;
  awsResources: AWSResourceInventory;
  historicalData?: CostSummary[]; // For trend analysis
}

export interface RedFlagDetectorOutput {
  redFlags: RedFlag[];
  detectionMetadata: {
    detectorId: string;
    detectorVersion: string;
    executionTimeMs: number;
    resourcesScanned: number;
  };
}

// ============================================
// AWS Resource Types
// ============================================

export interface AWSResource {
  resourceId: string;
  resourceType: string;
  service: string;
  region: string;
  tags: Record<string, string>;
  state: string; // running, stopped, available, etc.
  createdAt: string;
  monthlyCost: number;
  metadata: Record<string, unknown>;
}

export interface AWSResourceInventory {
  deploymentId: string;
  lastUpdated: string;
  resources: AWSResource[];
  totalResources: number;
  totalMonthlyCost: number;
  resourcesByService: Record<string, AWSResource[]>;
}

// ============================================
// Human-in-the-Loop Types
// ============================================

export interface ApprovalRequest {
  id: string;
  timestamp: string;
  action: 'stop_resource' | 'terminate_resource' | 'modify_resource' | 'create_resource';
  resourceId: string;
  resourceType: string;
  description: string;
  costImpact: {
    currentMonthlyCost: number;
    projectedMonthlyCost: number;
    monthlySavings: number;
  };
  risks: string[];
  reversible: boolean;
  requiresConfirmation: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ConfirmationWorkflow {
  approvalRequestId: string;
  step: 'initial_request' | 'awaiting_confirmation' | 'executing' | 'completed' | 'cancelled';
  userEmail: string;
  conversationThreadId: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    attempts: number;
    lastReminderSent?: string;
  };
}

// ============================================
// Detector Configuration Types
// ============================================

export interface DetectorConfig {
  enabled: boolean;
  severity: RedFlagSeverity;
  thresholds: Record<string, number>;
  excludedResources?: string[]; // Resource IDs to ignore
  excludedTags?: Record<string, string>; // Tags to ignore (e.g., {env: 'dev'})
}

export interface CostAnomalyDetectorConfig extends DetectorConfig {
  thresholds: {
    weekOverWeekIncreasePercent: number; // Default: 20
    dailyBudgetLimit?: number;
    monthlyBudgetLimit?: number;
  };
}

export interface ResourceWasteDetectorConfig extends DetectorConfig {
  thresholds: {
    maxCpuUtilizationPercent: number; // Default: 5
    minNetworkTrafficMbPerDay: number; // Default: 10
    minDiskIoOpsPerDay: number; // Default: 100
  };
  scanPeriodDays: number; // Default: 7
}

export interface SecurityRiskDetectorConfig extends DetectorConfig {
  thresholds: {
    maxOpenPortsPublic: number; // Default: 0
  };
  checkEncryption: boolean;
  checkPublicAccess: boolean;
  checkSecurityGroups: boolean;
}

// ============================================
// Learning System Types
// ============================================

export interface LearningInsight {
  type: 'pattern' | 'prediction' | 'recommendation' | 'warning';
  message: string;
  confidence: number;
  source: 'deployment_patterns' | 'cost_estimates' | 'user_decisions' | 'error_resolutions';
  metadata: {
    sampleSize?: number;
    accuracy?: number;
    lastUpdated?: string;
  };
}

export interface HyperspellQuery {
  collection: 'user_decisions' | 'deployment_patterns' | 'cost_estimates' | 'error_resolutions';
  query: string;
  filter?: Record<string, unknown>;
  limit?: number;
}

export interface HyperspellStoreRequest {
  collection: 'user_decisions' | 'deployment_patterns' | 'cost_estimates' | 'error_resolutions';
  data: UserDecisionMemory | DeploymentPatternMemory | CostEstimateMemory | ErrorResolutionMemory;
  metadata?: Record<string, unknown>;
}
