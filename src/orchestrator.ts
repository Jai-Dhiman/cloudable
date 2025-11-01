import { Mastra } from '@mastra/core';
import ora from 'ora';
import chalk from 'chalk';
import Table from 'cli-table3';
import boxen from 'boxen';
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

  console.log(boxen(
    chalk.bold.cyan('🤖 AI Agent Orchestration\n\n') +
    chalk.gray('Multi-agent system analyzing your project...'),
    {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ) + '\n');

  // Timeline tracking
  const timeline: Array<{ step: string; status: string; time?: number; details?: string }> = [
    { step: 'Code Analysis', status: 'pending' },
    { step: 'Infrastructure Recommendation', status: 'pending' },
    { step: 'Terraform Generation', status: 'pending' },
    { step: 'AWS Deployment', status: 'pending' }
  ];

  const displayTimeline = () => {
    console.log(chalk.bold('\n📋 Agent Timeline:\n'));
    timeline.forEach(item => {
      let icon = chalk.gray('○');
      let statusColor = chalk.gray;

      if (item.status === 'in_progress') {
        icon = chalk.cyan('⟳');
        statusColor = chalk.cyan;
      } else if (item.status === 'completed') {
        icon = chalk.green('✓');
        statusColor = chalk.green;
      } else if (item.status === 'failed') {
        icon = chalk.red('✗');
        statusColor = chalk.red;
      }

      const timeStr = item.time ? chalk.gray(` (${item.time.toFixed(1)}s)`) : '';
      const details = item.details ? chalk.gray(` - ${item.details}`) : '';
      console.log(`  ${icon} ${statusColor(item.step)}${timeStr}${details}`);
    });
    console.log('');
  };

  try {
    // Initialize agents
    const agents = getAgents();

    // Step 1: Code Analyzer Agent
    timeline[0].status = 'in_progress';
    displayTimeline();

    const startTime1 = Date.now();
    let spinner = ora(chalk.cyan('Agent analyzing codebase...')).start();
    try {
      // Stop spinner before agent thinking starts
      spinner.stop();
      const analysisResult = await agents.codeAnalyzerAgent.execute(state);
      Object.assign(state, analysisResult);
      const elapsed1 = (Date.now() - startTime1) / 1000;

      if (state.codeAnalysis) {
        timeline[0].status = 'completed';
        timeline[0].time = elapsed1;
        timeline[0].details = state.codeAnalysis.framework.framework;
        spinner.succeed(chalk.green(
          `Codebase analyzed (${state.codeAnalysis.framework.framework} detected)`
        ));
      } else {
        timeline[0].status = 'failed';
        spinner.fail(chalk.red('Code analysis failed'));
      }
    } catch (error) {
      timeline[0].status = 'failed';
      spinner.fail(chalk.red('Code analysis failed'));
      const errorMsg = error instanceof Error ? error.message : String(error);
      state.errors.push(`Code Analyzer: ${errorMsg}`);
      console.error(chalk.red(`  Error: ${errorMsg}`));
    }

    // Step 2: Infrastructure Recommender Agent
    timeline[1].status = 'in_progress';
    displayTimeline();

    const startTime2 = Date.now();
    spinner = ora(chalk.cyan('Agent generating infrastructure recommendations...')).start();
    try {
      // Stop spinner before agent thinking starts
      spinner.stop();
      const recommendResult = await agents.infraRecommenderAgent.execute(state);
      Object.assign(state, recommendResult);
      const elapsed2 = (Date.now() - startTime2) / 1000;

      if (state.infraRecommendation) {
        timeline[1].status = 'completed';
        timeline[1].time = elapsed2;
        timeline[1].details = `$${state.infraRecommendation.recommended.estimatedCost.monthly}/month`;
        spinner.succeed(chalk.green(
          `Infrastructure recommended ($${state.infraRecommendation.recommended.estimatedCost.monthly}/month)`
        ));
      } else {
        timeline[1].status = 'failed';
        spinner.fail(chalk.red('Infrastructure recommendation failed'));
      }
    } catch (error) {
      timeline[1].status = 'failed';
      spinner.fail(chalk.red('Infrastructure recommendation failed'));
      const errorMsg = error instanceof Error ? error.message : String(error);
      state.errors.push(`Infrastructure Recommender: ${errorMsg}`);
      console.error(chalk.red(`  Error: ${errorMsg}`));
    }

    // Step 3: Terraform Generator Agent (TODO)
    // timeline[2].status = 'in_progress';
    // displayTimeline();
    // ...

    // Step 4: Deployment Coordinator Agent (TODO)
    // timeline[3].status = 'in_progress';
    // displayTimeline();
    // ...

    displayTimeline();
    console.log(boxen(
      chalk.bold.green('✓ Agent orchestration complete'),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'green'
      }
    ) + '\n');

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

  // Framework Info Table
  const frameworkTable = new Table({
    head: [chalk.bold.cyan('Property'), chalk.bold.cyan('Value')],
    colWidths: [25, 50],
    style: {
      head: [],
      border: ['cyan']
    }
  });

  frameworkTable.push(['Framework', chalk.white(codeAnalysis.framework.framework)]);
  frameworkTable.push(['Runtime', chalk.white(codeAnalysis.framework.runtime)]);
  if (codeAnalysis.framework.packageManager) {
    frameworkTable.push(['Package Manager', chalk.white(codeAnalysis.framework.packageManager)]);
  }

  console.log(frameworkTable.toString() + '\n');

  // Services Table
  const servicesData: string[][] = [];
  if (codeAnalysis.services.database) {
    servicesData.push(['Database', codeAnalysis.services.database.type]);
  }
  if (codeAnalysis.services.cache) {
    servicesData.push(['Cache', codeAnalysis.services.cache.type]);
  }
  if (codeAnalysis.services.storage) {
    servicesData.push(['Storage', codeAnalysis.services.storage.type]);
  }
  if (codeAnalysis.services.websockets) {
    servicesData.push(['WebSockets', 'Enabled']);
  }

  if (servicesData.length > 0) {
    const servicesTable = new Table({
      head: [chalk.bold.cyan('Service Type'), chalk.bold.cyan('Details')],
      colWidths: [25, 50],
      style: {
        head: [],
        border: ['cyan']
      }
    });

    servicesData.forEach(row => {
      servicesTable.push([chalk.white(row[0]), chalk.white(row[1])]);
    });

    console.log(chalk.bold('Required Services:\n'));
    console.log(servicesTable.toString() + '\n');
  }

  // Build Config Table
  if (codeAnalysis.buildConfig) {
    const buildTable = new Table({
      head: [chalk.bold.cyan('Build Property'), chalk.bold.cyan('Command/Value')],
      colWidths: [25, 50],
      style: {
        head: [],
        border: ['cyan']
      }
    });

    if (codeAnalysis.buildConfig.buildCommand) {
      buildTable.push(['Build Command', chalk.gray(codeAnalysis.buildConfig.buildCommand)]);
    }
    if (codeAnalysis.buildConfig.startCommand) {
      buildTable.push(['Start Command', chalk.gray(codeAnalysis.buildConfig.startCommand)]);
    }
    if (codeAnalysis.buildConfig.port) {
      buildTable.push(['Port', chalk.white(String(codeAnalysis.buildConfig.port))]);
    }

    console.log(chalk.bold('Build Configuration:\n'));
    console.log(buildTable.toString() + '\n');
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

  // Services Table
  const servicesTable = new Table({
    head: [chalk.bold.cyan('Service'), chalk.bold.cyan('Description'), chalk.bold.cyan('Monthly Cost')],
    colWidths: [25, 50, 15],
    wordWrap: true,
    style: {
      head: [],
      border: ['cyan']
    }
  });

  option.services.forEach(service => {
    servicesTable.push([
      chalk.white(service.name),
      chalk.gray(service.description),
      chalk.green(`$${service.monthlyCost}`)
    ]);
  });

  console.log(servicesTable.toString() + '\n');

  // Cost Breakdown Table
  const costTable = new Table({
    head: [chalk.bold.cyan('Category'), chalk.bold.cyan('Monthly Cost')],
    colWidths: [30, 20],
    style: {
      head: [],
      border: ['cyan']
    }
  });

  if (option.estimatedCost.breakdown.compute) {
    costTable.push(['Compute', chalk.white(`$${option.estimatedCost.breakdown.compute}`)]);
  }
  if (option.estimatedCost.breakdown.database) {
    costTable.push(['Database', chalk.white(`$${option.estimatedCost.breakdown.database}`)]);
  }
  if (option.estimatedCost.breakdown.storage) {
    costTable.push(['Storage', chalk.white(`$${option.estimatedCost.breakdown.storage}`)]);
  }
  if (option.estimatedCost.breakdown.network) {
    costTable.push(['Network', chalk.white(`$${option.estimatedCost.breakdown.network}`)]);
  }
  if (option.estimatedCost.breakdown.cache) {
    costTable.push(['Cache', chalk.white(`$${option.estimatedCost.breakdown.cache}`)]);
  }

  costTable.push([
    { content: chalk.bold.white('TOTAL'), hAlign: 'right' },
    chalk.bold.green(`$${option.estimatedCost.monthly}`)
  ]);

  console.log(costTable.toString() + '\n');

  // Pros and Cons in a box
  const prosText = option.pros.map(pro => chalk.green(`  ✓ ${pro}`)).join('\n');
  const consText = option.cons.map(con => chalk.yellow(`  ⚠ ${con}`)).join('\n');

  console.log(boxen(
    chalk.bold('Pros:\n') + prosText + '\n\n' + chalk.bold('Cons:\n') + consText,
    {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'gray'
    }
  ));

  console.log('');
}
