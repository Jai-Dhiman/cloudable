import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { validateOpenAIKey, getOpenAIKey } from './mastra-config.js';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface PreflightAnalysis {
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  framework: string;
  frameworkVersion?: string;
  fixesApplied: string[];
  recommendations: string[];
  dockerContext: Record<string, any>;
}

/**
 * AI Agent for pre-flight checks and fixes before Docker generation
 * Uses Mastra with memory to learn from the codebase
 */
export class PreflightAgent {
  private agent: Agent;
  private projectContext: any;
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    validateOpenAIKey();
    const apiKey = getOpenAIKey();
    
    const openai = createOpenAI({ apiKey });
    
    this.agent = new Agent({
      name: 'preflight-fixer',
      instructions: `You are an expert DevOps engineer specializing in containerizing applications.
      
Your job is to analyze codebases and fix common Docker deployment issues:

1. PACKAGE MANAGER DETECTION:
   - Check for lockfiles: package-lock.json (npm), yarn.lock (yarn), pnpm-lock.yaml (pnpm), bun.lockb (bun)
   - Remember which package manager is used for Dockerfile generation

2. FRAMEWORK-SPECIFIC FIXES:
   - Next.js: Ensure 'output: standalone' is in next.config.js/mjs/ts
   - Next.js: Verify production build settings
   - React: Check build scripts
   - Node.js: Verify start scripts

3. CONFIGURATION ISSUES:
   - Missing production environment settings
   - Incorrect port configurations
   - Missing dependencies in package.json

4. ANALYZE & FIX:
   - Read relevant config files
   - Apply fixes directly
   - Document what was changed

Return structured JSON with your findings and fixes.`,
      model: openai('gpt-4o'),
    });

    this.workingDir = workingDir;
    this.projectContext = {};
  }

  /**
   * Run complete pre-flight analysis and fixes
   */
  async runPreflightChecks(): Promise<PreflightAnalysis> {
    console.log(chalk.bold.cyan('\n🔍 Pre-Flight Analysis\n'));
    console.log(chalk.gray('Analyzing codebase for Docker compatibility...\n'));

    const spinner = ora('Detecting project configuration...').start();

    try {
      // Step 1: Detect package manager
      const packageManager = this.detectPackageManager();
      spinner.succeed(chalk.green(`✅ Package Manager: ${packageManager}`));

      // Step 2: Detect framework
      const framework = await this.detectFramework();
      spinner.text = `Detected framework: ${framework}`;
      spinner.succeed(chalk.green(`✅ Framework: ${framework}`));

      // Step 3: Run AI analysis
      spinner.start('AI analyzing codebase for Docker issues...');
      const analysis = await this.analyzeWithAI(packageManager, framework);
      spinner.succeed(chalk.green('✅ AI analysis complete'));

      // Step 4: Apply fixes
      if (analysis.fixesNeeded.length > 0) {
        spinner.start('Applying fixes...');
        const fixesApplied = await this.applyFixes(analysis.fixesNeeded);
        spinner.succeed(chalk.green(`✅ Applied ${fixesApplied.length} fixes`));

        // Display fixes
        console.log(chalk.cyan('\n📝 Fixes Applied:\n'));
        fixesApplied.forEach((fix, i) => {
          console.log(chalk.gray(`   ${i + 1}. ${fix}`));
        });
      } else {
        console.log(chalk.green('\n✅ No fixes needed - codebase is Docker-ready!\n'));
      }

      // Step 5: Store in memory for Dockerfile generation
      this.projectContext = {
        packageManager,
        framework,
        fixesApplied: analysis.fixesApplied || [],
        dockerContext: analysis.dockerContext,
      };

      const result: PreflightAnalysis = {
        packageManager,
        framework,
        fixesApplied: analysis.fixesApplied || [],
        recommendations: analysis.recommendations || [],
        dockerContext: analysis.dockerContext || {},
      };

      console.log(chalk.bold.green('\n🎉 Pre-flight checks complete!\n'));

      return result;

    } catch (error: any) {
      spinner.fail(chalk.red('❌ Pre-flight analysis failed'));
      throw error;
    }
  }

  /**
   * Detect package manager from lockfiles
   */
  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
    if (fs.existsSync(path.join(this.workingDir, 'package-lock.json'))) {
      return 'npm';
    }
    if (fs.existsSync(path.join(this.workingDir, 'yarn.lock'))) {
      return 'yarn';
    }
    if (fs.existsSync(path.join(this.workingDir, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(this.workingDir, 'bun.lockb'))) {
      return 'bun';
    }
    return 'npm'; // default
  }

  /**
   * Detect framework from package.json
   */
  private async detectFramework(): Promise<string> {
    const packageJsonPath = path.join(this.workingDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return 'unknown';
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps['next']) return `Next.js ${deps['next']}`;
    if (deps['react']) return `React ${deps['react']}`;
    if (deps['vue']) return `Vue ${deps['vue']}`;
    if (deps['express']) return `Express ${deps['express']}`;
    if (deps['fastify']) return `Fastify ${deps['fastify']}`;

    return 'Node.js';
  }

  /**
   * Use AI to analyze codebase for Docker issues
   */
  private async analyzeWithAI(packageManager: string, framework: string): Promise<any> {
    // Read key config files
    const configFiles = this.readConfigFiles();

    const prompt = `You are an expert DevOps engineer. Analyze this ${framework} project for Docker deployment and generate the exact file edits needed.

Package Manager: ${packageManager}
Framework: ${framework}

Configuration Files:
${JSON.stringify(configFiles, null, 2)}

Your task:
1. Identify what needs to be fixed for Docker deployment
2. For each file that needs changes, generate the COMPLETE NEW FILE CONTENT (not just snippets)
3. Provide specific build and start commands

Return ONLY valid JSON in this EXACT format (no markdown, no code blocks):
{
  "fixesNeeded": [
    {
      "file": "next.config.js",
      "issue": "Missing 'output: standalone' for Docker",
      "newContent": "/** @type {import('next').NextConfig} */\\nconst nextConfig = {\\n  output: 'standalone',\\n  images: {...}\\n};\\n\\nmodule.exports = nextConfig;"
    }
  ],
  "recommendations": ["Use multi-stage builds", "Use Alpine base image"],
  "dockerContext": {
    "packageManager": "${packageManager}",
    "buildCommand": "npm run build",
    "startCommand": "node server.js"
  }
}

Rules:
- If next.config.js needs output: 'standalone', provide the COMPLETE file with that addition
- Preserve all existing configuration (images, etc.)
- newContent must be the COMPLETE file content as a string
- Use \\n for newlines in the JSON string
- Return ONLY the JSON object, no extra text`;

    const response = await this.agent.generate(prompt);
    
    try {
      // Extract JSON from response - try multiple patterns
      let jsonText = response.text.trim();
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Try to find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Ensure fixesApplied exists
        if (!parsed.fixesApplied) {
          parsed.fixesApplied = [];
        }
        
        return parsed;
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Failed to parse AI response, using defaults'));
    }

    return {
      fixesNeeded: [],
      fixesApplied: [],
      recommendations: [],
      dockerContext: { packageManager, framework },
    };
  }

  /**
   * Read important config files for AI analysis
   */
  private readConfigFiles(): Record<string, any> {
    const files: Record<string, any> = {};

    // Next.js configs
    for (const name of ['next.config.js', 'next.config.mjs', 'next.config.ts']) {
      const filePath = path.join(this.workingDir, name);
      if (fs.existsSync(filePath)) {
        files[name] = fs.readFileSync(filePath, 'utf-8');
      }
    }

    // package.json
    const packageJsonPath = path.join(this.workingDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      files['package.json'] = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    }

    // tsconfig.json
    const tsconfigPath = path.join(this.workingDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      files['tsconfig.json'] = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    }

    return files;
  }

  /**
   * Apply fixes identified by AI (using AI-generated code)
   */
  private async applyFixes(fixes: any[]): Promise<string[]> {
    const applied: string[] = [];

    for (const fix of fixes) {
      try {
        const filePath = path.join(this.workingDir, fix.file);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          console.warn(chalk.yellow(`⚠️  File not found: ${fix.file}`));
          continue;
        }

        // Check if newContent is provided (AI-generated code)
        if (fix.newContent) {
          // Read current content for comparison
          const currentContent = fs.readFileSync(filePath, 'utf-8');
          
          // Check if the fix is actually needed
          if (currentContent.includes("output:") && currentContent.includes("'standalone'")) {
            applied.push(`${fix.file} already has required configuration`);
            continue;
          }

          // Write the AI-generated content
          fs.writeFileSync(filePath, fix.newContent, 'utf-8');
          applied.push(`Applied AI-generated fix to ${fix.file}: ${fix.issue}`);
          
          console.log(chalk.gray(`   📝 ${fix.file}: ${fix.issue}`));
        } else {
          console.warn(chalk.yellow(`⚠️  No newContent provided for ${fix.file}`));
        }
      } catch (error: any) {
        console.warn(chalk.yellow(`⚠️  Could not apply fix to ${fix.file}: ${error.message}`));
      }
    }

    return applied;
  }

  /**
   * Get stored project context
   */
  getProjectContext(): any {
    return this.projectContext;
  }
}

