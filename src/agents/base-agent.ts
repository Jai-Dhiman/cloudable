import { Agent as MastraAgent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import type { ProjectAnalysis } from '../types/analysis.js';
import type { InfrastructureRecommendation } from '../types/infrastructure.js';
import type { DockerConfiguration } from '../types/ai.types.js';

export interface UserAnswers {
  cloudProvider: string;
  expectedDAU: number;
  budget: number;
  customDomain?: string;
  awsRegion: string;
}

export interface TerraformConfigs {
  [key: string]: string;
}

export interface DeploymentResult {
  success: boolean;
  url?: string;
  message: string;
  terraformOutputs?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface AgentState {
  projectId: string;
  projectPath: string;
  codeAnalysis?: ProjectAnalysis;
  userAnswers?: UserAnswers;
  infraRecommendation?: InfrastructureRecommendation;
  terraformConfigs?: TerraformConfigs;
  dockerConfigs?: DockerConfiguration;
  dnsSetup?: any;
  validationResult?: ValidationResult;
  deploymentResult?: DeploymentResult;
  errors: string[];
}

export interface AgentConfig {
  name: string;
  instructions: string;
  model?: string;
}

export abstract class BaseAgent {
  protected mastraAgent: MastraAgent;
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;

    // Validate OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Initialize Mastra Agent with OpenAI provider
    // Mastra uses the format 'provider/model-name'
    this.mastraAgent = new MastraAgent({
      name: config.name,
      instructions: config.instructions,
      model: openai(config.model || 'gpt-4o')
    });
  }

  abstract execute(state: AgentState): Promise<AgentState>;

  protected updateState(state: AgentState, updates: Partial<AgentState>): AgentState {
    return {
      ...state,
      ...updates
    };
  }

  protected addError(state: AgentState, error: string): AgentState {
    return {
      ...state,
      errors: [...state.errors, error]
    };
  }

  getName(): string {
    return this.config.name;
  }

  getInstructions(): string {
    return this.config.instructions;
  }

  getMastraAgent(): MastraAgent {
    return this.mastraAgent;
  }
}
