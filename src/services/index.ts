export { CostAnalysisService } from './cost-analysis-service.js';
export type { CostAnalysisResult, CostAnalysisConfig } from './cost-analysis-service.js';

export { CostProjectionEngine } from './cost-projection-engine.js';
export type { CostPrediction, MonthlyCostProjection } from './cost-projection-engine.js';

export { RedFlagAggregator } from './red-flag-aggregator.js';
export type { RedFlagSummary, RedFlagAggregatorResult } from './red-flag-aggregator.js';

export { DemoDataGenerator } from './demo-data-generator.js';

export { EmailMonitorService, createEmailMonitor } from './email-monitor.js';
export type { EmailMonitorOptions, MonitoredReply } from './email-monitor.js';

export { ActionExecutorService, createActionExecutor } from './action-executor.js';
export type { ActionResult, ExecutionContext } from './action-executor.js';

export { ConfirmationHandler, createConfirmationHandler } from './confirmation-handler.js';
export type { ConfirmationResult } from './confirmation-handler.js';

export { CommandProcessor, createCommandProcessor } from './command-processor.js';
export type { CommandProcessingResult } from './command-processor.js';

export { EmailService } from './email-service.js';

export { PDFGeneratorService } from './pdf-generator.service.js';
export { ReportGenerationService } from './report-generation.service.js';
export type { ReportGenerationConfig, ReportGenerationResult } from './report-generation.service.js';
