import { Agent as MastraAgent } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import chalk from 'chalk';
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

  /**
   * Generate AI response with visible thinking process
   * Streams the response in a fixed-size scrolling box
   */
  protected async generateWithThinking(
    prompt: string,
    options?: {
      title?: string;
      showPrompt?: boolean;
    }
  ): Promise<string> {
    const title = options?.title || 'Thinking';
    const showPrompt = options?.showPrompt || false;

    // Show the prompt if requested
    if (showPrompt) {
      console.log(chalk.dim('\n┌─ Prompt ─────────────────────────────────'));
      const promptLines = prompt.split('\n').slice(0, 10);
      promptLines.forEach(line => {
        console.log(chalk.dim('│ ') + chalk.gray(line.substring(0, 80)));
      });
      if (prompt.split('\n').length > 10) {
        console.log(chalk.dim('│ ') + chalk.gray('... (truncated)'));
      }
      console.log(chalk.dim('└──────────────────────────────────────────\n'));
    }

    const BOX_WIDTH = 80;
    const BOX_HEIGHT = 8; // Fixed height for the thinking box
    let fullText = '';
    let lines: string[] = [];

    // ANSI escape codes
    const CLEAR_LINE = '\x1b[2K';
    const MOVE_UP = '\x1b[1A';
    const HIDE_CURSOR = '\x1b[?25l';
    const SHOW_CURSOR = '\x1b[?25h';

    // Helper to wrap text to box width
    const wrapText = (text: string, width: number): string[] => {
      const words = text.split(' ');
      const wrapped: string[] = [];
      let currentLine = '';

      for (const word of words) {
        if (word.includes('\n')) {
          const parts = word.split('\n');
          for (let i = 0; i < parts.length; i++) {
            if (i > 0) {
              wrapped.push(currentLine.trim());
              currentLine = '';
            }
            if (parts[i]) {
              if ((currentLine + ' ' + parts[i]).length <= width - 4) {
                currentLine += (currentLine ? ' ' : '') + parts[i];
              } else {
                if (currentLine) wrapped.push(currentLine.trim());
                currentLine = parts[i];
              }
            }
          }
        } else if ((currentLine + ' ' + word).length <= width - 4) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) wrapped.push(currentLine.trim());
          currentLine = word;
        }
      }
      if (currentLine) wrapped.push(currentLine.trim());
      return wrapped;
    };

    // Helper to render the box
    const renderBox = (contentLines: string[], isComplete: boolean = false) => {
      const header = isComplete ? '✓ Agent Reasoning Complete' : '💭 ' + title;
      const topBorder = '┌─' + header + '─'.repeat(Math.max(0, BOX_WIDTH - header.length - 3)) + '┐';
      const bottomBorder = '└' + '─'.repeat(BOX_WIDTH - 2) + '┘';

      // Get last N lines to show in the box
      const visibleLines = contentLines.slice(-BOX_HEIGHT);

      // Build the box
      const output = [topBorder];
      for (let i = 0; i < BOX_HEIGHT; i++) {
        const line = visibleLines[i] || '';
        const padding = ' '.repeat(Math.max(0, BOX_WIDTH - line.length - 4));
        output.push('│ ' + chalk.gray(line) + padding + ' │');
      }
      output.push(bottomBorder);

      return output.join('\n');
    };

    try {
      // Hide cursor
      process.stdout.write(HIDE_CURSOR);

      // Initial render
      console.log('\n' + renderBox([]));

      // Use AI SDK's streamText for real-time streaming
      const result = await streamText({
        model: openai(this.config.model || 'gpt-4o'),
        messages: [
          {
            role: 'system',
            content: this.config.instructions
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Stream the response
      for await (const chunk of result.textStream) {
        fullText += chunk;

        // Re-wrap all text
        lines = wrapText(fullText, BOX_WIDTH);

        // Move cursor up to redraw the box
        for (let i = 0; i < BOX_HEIGHT + 2; i++) {
          process.stdout.write(MOVE_UP + CLEAR_LINE);
        }

        // Redraw box with updated content
        process.stdout.write(renderBox(lines) + '\n');
      }

      // Final render with completion indicator
      for (let i = 0; i < BOX_HEIGHT + 2; i++) {
        process.stdout.write(MOVE_UP + CLEAR_LINE);
      }
      console.log(renderBox(lines, true));

      // Show cursor
      process.stdout.write(SHOW_CURSOR);

      console.log(''); // Extra newline

      return fullText;
    } catch (error) {
      // Show cursor on error
      process.stdout.write(SHOW_CURSOR);
      console.log(chalk.red(`\n✗ Thinking failed: ${error instanceof Error ? error.message : String(error)}\n`));
      throw error;
    }
  }

  /**
   * Original generate method using Mastra (non-streaming)
   */
  protected async generate(prompt: string): Promise<{ text: string }> {
    return await this.mastraAgent.generate(prompt);
  }
}
