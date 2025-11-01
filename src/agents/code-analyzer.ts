import { BaseAgent, type AgentState } from './base-agent.js';
import { AIProjectAnalyzer } from '../analyzers/ai-project-analyzer.js';
import type { ProjectAnalysis, FrameworkDetection, ServiceRequirements } from '../types/analysis.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export class CodeAnalyzerAgent extends BaseAgent {
  constructor() {
    super({
      name: 'code-analyzer',
      instructions: `You are a code analysis expert. Your job is to analyze a codebase and determine:

1. Framework and runtime (Next.js, Django, Express, etc.)
2. Required services (PostgreSQL, Redis, MongoDB, S3, etc.)
3. Infrastructure patterns (WebSockets, background jobs, file uploads, authentication)
4. Build configuration (commands, ports, environment variables)

Provide a detailed analysis that will be used to recommend AWS infrastructure.`,
      model: 'gpt-4o'
    });
  }

  async execute(state: AgentState): Promise<AgentState> {
    try {
      // Step 1: Gather project files
      const analyzer = new AIProjectAnalyzer(state.projectPath);
      const files = await analyzer.gatherProjectFiles();
      const formattedFiles = analyzer.formatFilesForAI(files);

      // Step 2: Use Mastra AI agent to analyze
      const prompt = `Analyze this codebase and provide a structured summary:

${formattedFiles}

Return a JSON object with:
{
  "framework": {
    "name": "framework name (e.g., Next.js, Django, Express)",
    "framework": "nextjs|django|express|flask|react|etc",
    "type": "fullstack|api|web|static",
    "runtime": "node|python|go|etc",
    "version": "version if detected",
    "packageManager": "npm|yarn|pnpm|bun|pip|etc"
  },
  "services": {
    "database": { "type": "postgresql|mysql|mongodb|redis|etc", "required": true/false, "detectedFrom": "explanation" },
    "cache": { "type": "redis|memcached", "required": true/false, "detectedFrom": "explanation" },
    "storage": { "type": "s3|gcs|local", "required": true/false, "detectedFrom": "explanation" },
    "queue": { "type": "sqs|redis|rabbitmq", "required": true/false, "detectedFrom": "explanation" },
    "websockets": { "required": true/false, "detectedFrom": "explanation" }
  },
  "buildConfig": {
    "buildCommand": "command to build",
    "startCommand": "command to start",
    "port": number,
    "healthCheckPath": "/health or /api/health"
  },
  "summary": "2-3 sentence summary of what this application does"
}`;

      // Use streaming with visible thinking
      const resultText = await this.generateWithThinking(prompt, {
        title: 'Analyzing codebase structure',
        showPrompt: false // Set to true to see the full prompt
      });

      // Parse AI response
      const aiAnalysis = this.parseAIResponse(resultText);

      // Build final analysis
      const analysis: ProjectAnalysis = {
        projectPath: state.projectPath,
        projectName: state.projectPath.split('/').pop() || 'unknown',
        deploymentDocs: {
          hasDockerfile: !!files.dockerfile,
          hasDockerCompose: !!files.dockerCompose,
          hasTerraform: (files.terraform?.length || 0) > 0,
          hasReadme: !!files.readme,
          hasDeploymentGuide: false,
          dockerComposeServices: files.dockerCompose ? this.parseDockerComposeServices(files.dockerCompose) : undefined
        },
        framework: aiAnalysis.framework,
        services: aiAnalysis.services,
        buildConfig: aiAnalysis.buildConfig,
        environmentVars: await this.detectEnvironmentVars(state.projectPath),
        confidence: 90
      };

      return this.updateState(state, { codeAnalysis: analysis });
    } catch (error) {
      const errorMessage = `Code analysis failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`✗ ${errorMessage}`);
      return this.addError(state, errorMessage);
    }
  }

  private parseAIResponse(text: string): any {
    try {
      // Extract JSON from AI response (might be wrapped in markdown code blocks)
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }
      return JSON.parse(text);
    } catch (error) {
      // Fallback to basic detection if AI response parsing fails
      console.warn('  AI response parsing failed, using basic detection');
      return {
        framework: { name: 'Unknown', framework: 'unknown', type: 'unknown', runtime: 'unknown' },
        services: {},
        buildConfig: {},
        summary: 'Could not analyze project'
      };
    }
  }


  private async detectEnvironmentVars(projectPath: string): Promise<any[]> {
    const envVars: any[] = [];

    // Check for .env.example
    const envExamplePath = join(projectPath, '.env.example');
    if (existsSync(envExamplePath)) {
      const content = await readFile(envExamplePath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, example] = trimmed.split('=');
          if (key) {
            envVars.push({
              key: key.trim(),
              required: true,
              example: example?.trim(),
              description: `Environment variable for ${key.trim()}`
            });
          }
        }
      }
    }

    return envVars;
  }

  private parseDockerComposeServices(dockerCompose: string): string[] {
    const services: string[] = [];
    const lines = dockerCompose.split('\n');
    let inServices = false;

    for (const line of lines) {
      if (line.trim() === 'services:') {
        inServices = true;
        continue;
      }

      if (inServices && line.match(/^  \w+:/)) {
        const serviceName = line.trim().replace(':', '');
        services.push(serviceName);
      }
    }

    return services;
  }
}

export async function executeCodeAnalyzer(state: AgentState, projectPath: string): Promise<AgentState> {
  const agent = new CodeAnalyzerAgent();
  return agent.execute({ ...state, projectPath });
}
