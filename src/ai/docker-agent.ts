import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { validateOpenAIKey, getOpenAIKey } from './mastra-config.js';
import { createFileDiscoveryPrompt } from './prompts/file-discovery.js';
import { createDockerfileGenerationPrompt } from './prompts/dockerfile-generation.js';
import type { ProjectFile, FileDiscoveryResult, DockerConfiguration } from '../types/ai.types.js';

export class DockerGenerationAgent {
  private agent: Agent;

  constructor() {
    // Validate OpenAI API key exists
    validateOpenAIKey();
    const apiKey = getOpenAIKey();
    
    // Create OpenAI provider
    const openai = createOpenAI({ apiKey });
    
    // Create a specialized agent for Docker generation
    this.agent = new Agent({
      name: 'docker-generator',
      instructions: 'You are an expert DevOps engineer specializing in Docker containerization and cloud deployments.',
      model: openai('gpt-4-turbo'),
    });
  }

  /**
   * Phase 1: Ask AI which files to read
   */
  async discoverFiles(directoryTree: string): Promise<string[]> {
    const prompt = createFileDiscoveryPrompt(directoryTree);

    try {
      const response = await this.agent.generate(prompt);

      // Parse JSON response
      const text = response.text || '';
      
      // Try to extract JSON array
      let files: string[] = [];
      
      try {
        // Direct JSON parse
        files = JSON.parse(text);
      } catch (e) {
        // Try to extract from markdown code block
        const match = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
        if (match) {
          files = JSON.parse(match[1]);
        } else {
          // Try to find JSON array in text
          const arrayMatch = text.match(/\[[\s\S]*?\]/);
          if (arrayMatch) {
            files = JSON.parse(arrayMatch[0]);
          }
        }
      }

      if (!Array.isArray(files)) {
        throw new Error('AI did not return a valid array of file paths');
      }

      return files;

    } catch (error: any) {
      console.error('Error in file discovery phase:', error.message);
      throw error;
    }
  }

  /**
   * Phase 2: Generate Docker configurations
   */
  async generateConfigurations(files: ProjectFile[]): Promise<DockerConfiguration> {
    const prompt = createDockerfileGenerationPrompt(files);

    try {
      const response = await this.agent.generate(prompt);

      const text = response.text || '';

      // Extract each configuration using XML tags
      const dockerfile = this.extractTag(text, 'dockerfile');
      const dockerignore = this.extractTag(text, 'dockerignore');
      const dockerCompose = this.extractTag(text, 'docker_compose');
      const explanation = this.extractTag(text, 'explanation');

      if (!dockerfile) {
        throw new Error('AI did not generate a Dockerfile');
      }

      return {
        dockerfile,
        dockerignore: dockerignore || this.getDefaultDockerignore(),
        dockerCompose: dockerCompose !== 'NOT_NEEDED' ? dockerCompose : undefined,
        explanation
      };

    } catch (error: any) {
      console.error('Error in Dockerfile generation phase:', error.message);
      throw error;
    }
  }

  /**
   * Extract content from XML-style tags
   */
  private extractTag(text: string, tagName: string): string | undefined {
    const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*</${tagName}>`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Fallback .dockerignore if AI doesn't generate one
   */
  private getDefaultDockerignore(): string {
    return `# Dependencies
node_modules
npm-debug.log
yarn-error.log

# Build output
dist
build
.next
out

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Git
.git
.gitignore

# Tests
coverage
*.test.js
*.spec.js
__tests__
test

# Documentation
*.md
docs

# CI/CD
.github
.gitlab-ci.yml

# Python
__pycache__
*.pyc
*.pyo
*.pyd
.Python
venv
.venv

# Docker
Dockerfile
docker-compose.yml
.dockerignore
`;
  }
}

