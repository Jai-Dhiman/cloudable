import { Mastra } from '@mastra/core';
import ora from 'ora';
import chalk from 'chalk';
import { CodeAnalyzerAgent } from './agents/code-analyzer.js';
import { InfraRecommenderAgent } from './agents/infra-recommender.js';
import type { AgentState, UserAnswers } from './agents/base-agent.js';
import { v4 as uuidv4 } from 'uuid';

// Lazy initialization - only create agents when needed
let codeAnalyzerAgent: CodeAnalyzerAgent | null = null;
let infraRecommenderAgent: InfraRecommenderAgent | null = null;
let mastra: Mastra | null = null;

function getAgents() {
  if (!codeAnalyzerAgent) {
    codeAnalyzerAgent = new CodeAnalyzerAgent();
  }
  if (!infraRecommenderAgent) {
    infraRecommenderAgent = new InfraRecommenderAgent();
  }
  return { codeAnalyzerAgent, infraRecommenderAgent };
}

function getMastra() {
  if (!mastra) {
    const agents = getAgents();
    mastra = new Mastra({
      agents: {
        codeAnalyzer: agents.codeAnalyzerAgent.getMastraAgent(),
        infraRecommender: agents.infraRecommenderAgent.getMastraAgent()
      }
    });
  }
  return mastra;
}

// Export for backward compatibility
export { getMastra as mastra };

export interface OrchestrationOptions {
  projectPath: string;
  userAnswers: UserAnswers;
}

export async function orchestrateCloudableWorkflow(
  options: OrchestrationOptions
): Promise<AgentState> {
  const { projectPath, userAnswers } = options;

  // Initialize state
  const state: AgentState = {
    projectId: uuidv4(),
    projectPath,
    userAnswers,
    errors: []
  };

  console.log(chalk.bold.cyan('\n🤖 Starting AI Agent Orchestration\n'));

  try {
    // Initialize agents
    const agents = getAgents();

    // Step 1: Code Analyzer Agent
    let spinner = ora(chalk.cyan('Agent 1/2: Analyzing codebase...')).start();
    try {
      const analysisResult = await agents.codeAnalyzerAgent.execute(state);
      Object.assign(state, analysisResult);

      if (state.codeAnalysis) {
        spinner.succeed(chalk.green(
          `Agent 1/2: Codebase analyzed (${state.codeAnalysis.framework.framework} detected)`
        ));
      } else {
        spinner.fail(chalk.red('Agent 1/2: Code analysis failed'));
      }
    } catch (error) {
      spinner.fail(chalk.red('Agent 1/2: Code analysis failed'));
      const errorMsg = error instanceof Error ? error.message : String(error);
      state.errors.push(`Code Analyzer: ${errorMsg}`);
      console.error(chalk.red(`  Error: ${errorMsg}`));
    }

    // Step 2: Infrastructure Recommender Agent
    spinner = ora(chalk.cyan('Agent 2/2: Generating infrastructure recommendations...')).start();
    try {
      const recommendResult = await agents.infraRecommenderAgent.execute(state);
      Object.assign(state, recommendResult);

      if (state.infraRecommendation) {
        spinner.succeed(chalk.green(
          `Agent 2/2: Infrastructure recommended ($${state.infraRecommendation.recommended.estimatedCost.monthly}/month)`
        ));
      } else {
        spinner.fail(chalk.red('Agent 2/2: Infrastructure recommendation failed'));
      }
    } catch (error) {
      spinner.fail(chalk.red('Agent 2/2: Infrastructure recommendation failed'));
      const errorMsg = error instanceof Error ? error.message : String(error);
      state.errors.push(`Infrastructure Recommender: ${errorMsg}`);
      console.error(chalk.red(`  Error: ${errorMsg}`));
    }

    // Step 3: Terraform Generator Agent (TODO)
    // spinner = ora(chalk.cyan('Agent 3/5: Generating Terraform configuration...')).start();
    // ...

    // Step 4: Deployment Coordinator Agent (TODO)
    // spinner = ora(chalk.cyan('Agent 4/5: Deploying to AWS...')).start();
    // ...

    // Step 5: Cost Monitor Agent (TODO)
    // spinner = ora(chalk.cyan('Agent 5/5: Setting up cost monitoring...')).start();
    // ...

    console.log(chalk.bold.green('\n✓ Agent orchestration complete\n'));

    // Display any errors
    if (state.errors.length > 0) {
      console.log(chalk.bold.yellow('⚠️  Errors encountered:'));
      state.errors.forEach((error, index) => {
        console.log(chalk.yellow(`  ${index + 1}. ${error}`));
      });
      console.log('');
    }

    return state;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.bold.red(`\n✗ Orchestration failed: ${errorMsg}\n`));
    state.errors.push(`Orchestrator: ${errorMsg}`);
    return state;
  }
}

// Helper function to display detailed analysis results
export function displayAnalysisResults(state: AgentState): void {
  if (!state.codeAnalysis) {
    console.log(chalk.yellow('No code analysis available'));
    return;
  }

  const { codeAnalysis } = state;

  console.log(chalk.bold('📊 Analysis Results:\n'));

  // Framework
  console.log(chalk.bold('  Framework:'));
  console.log(chalk.gray(`    ${codeAnalysis.framework.framework} (${codeAnalysis.framework.runtime})`));
  if (codeAnalysis.framework.packageManager) {
    console.log(chalk.gray(`    Package Manager: ${codeAnalysis.framework.packageManager}`));
  }

  // Services
  console.log(chalk.bold('\n  Required Services:'));
  if (codeAnalysis.services.database) {
    console.log(chalk.gray(`    Database: ${codeAnalysis.services.database.type}`));
  }
  if (codeAnalysis.services.cache) {
    console.log(chalk.gray(`    Cache: ${codeAnalysis.services.cache.type}`));
  }
  if (codeAnalysis.services.storage) {
    console.log(chalk.gray(`    Storage: ${codeAnalysis.services.storage.type}`));
  }
  if (codeAnalysis.services.websockets) {
    console.log(chalk.gray(`    WebSockets: Yes`));
  }

  // Build Config
  if (codeAnalysis.buildConfig) {
    console.log(chalk.bold('\n  Build Configuration:'));
    if (codeAnalysis.buildConfig.buildCommand) {
      console.log(chalk.gray(`    Build: ${codeAnalysis.buildConfig.buildCommand}`));
    }
    if (codeAnalysis.buildConfig.startCommand) {
      console.log(chalk.gray(`    Start: ${codeAnalysis.buildConfig.startCommand}`));
    }
    if (codeAnalysis.buildConfig.port) {
      console.log(chalk.gray(`    Port: ${codeAnalysis.buildConfig.port}`));
    }
  }

  console.log('');
}

// Helper function to display infrastructure recommendations
export function displayInfraRecommendations(state: AgentState): void {
  if (!state.infraRecommendation) {
    console.log(chalk.yellow('No infrastructure recommendations available'));
    return;
  }

  const { infraRecommendation } = state;
  const option = infraRecommendation.recommended;

  console.log(chalk.bold('🏗️  Infrastructure Recommendations:\n'));

  console.log(chalk.bold(`  ${option.name}`));
  console.log(chalk.gray(`  ${option.description}\n`));

  // Services
  console.log(chalk.bold('  Services:'));
  option.services.forEach(service => {
    console.log(chalk.cyan(`    • ${service.name}`));
    console.log(chalk.gray(`      ${service.description}`));
    console.log(chalk.gray(`      Cost: $${service.monthlyCost}/month`));
  });

  // Cost Breakdown
  console.log(chalk.bold('\n  Cost Breakdown:'));
  if (option.estimatedCost.breakdown.compute) {
    console.log(chalk.gray(`    Compute: $${option.estimatedCost.breakdown.compute}`));
  }
  if (option.estimatedCost.breakdown.database) {
    console.log(chalk.gray(`    Database: $${option.estimatedCost.breakdown.database}`));
  }
  if (option.estimatedCost.breakdown.storage) {
    console.log(chalk.gray(`    Storage: $${option.estimatedCost.breakdown.storage}`));
  }
  if (option.estimatedCost.breakdown.network) {
    console.log(chalk.gray(`    Network: $${option.estimatedCost.breakdown.network}`));
  }
  if (option.estimatedCost.breakdown.cache) {
    console.log(chalk.gray(`    Cache: $${option.estimatedCost.breakdown.cache}`));
  }
  console.log(chalk.bold.white(`    Total: $${option.estimatedCost.monthly}/month`));

  // Pros/Cons
  console.log(chalk.bold('\n  Pros:'));
  option.pros.forEach(pro => {
    console.log(chalk.green(`    ✓ ${pro}`));
  });

  console.log(chalk.bold('\n  Cons:'));
  option.cons.forEach(con => {
    console.log(chalk.yellow(`    ⚠ ${con}`));
  });

  console.log('');
}
