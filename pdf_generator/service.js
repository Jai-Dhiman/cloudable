/**
 * Template-based PDF generation service
 * Provides a unified interface for generating PDFs using templates
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { TemplateRegistry } from './registry.js';
import { TemplateLoader } from './loader.js';
import { TemplateEngine } from './engine.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class PDFGeneratorService {
    registry;
    constructor(templatesDir) {
        if (!templatesDir) {
            // Resolve templates directory relative to this file
            // Works in both development and production builds
            const currentDir = __dirname;
            // In dist, pdf_generator will be at dist/pdf_generator
            // In development (ts-node), pdf_generator will be at pdf_generator
            // Try multiple locations
            const possiblePaths = [
                join(currentDir, 'templates'), // Production: dist/pdf_generator/templates
                join(currentDir, '..', 'pdf_generator', 'templates'), // Development fallback
                join(process.cwd(), 'pdf_generator', 'templates'), // Root fallback
            ];
            // Use first existing path
            templatesDir = possiblePaths.find(path => existsSync(path)) || possiblePaths[0];
        }
        this.registry = new TemplateRegistry(templatesDir);
    }
    async initialize() {
        await this.registry.loadTemplates();
    }
    listAvailableTemplates() {
        return this.registry.listTemplates();
    }
    async generatePDF(analysis, templateId = 'default') {
        await this.initialize();
        if (!this.registry.templateExists(templateId)) {
            console.warn(`Template '${templateId}' not found, falling back to 'default'`);
            templateId = 'default';
        }
        const templateConfig = this.registry.getTemplate(templateId);
        if (!templateConfig || !templateConfig.path) {
            throw new Error(`Template '${templateId}' configuration not found`);
        }
        const loader = new TemplateLoader(templateConfig.path);
        await loader.loadConfig();
        const context = this.createContext(analysis);
        const engine = new TemplateEngine(loader);
        return await engine.render(context);
    }
    createContext(analysis) {
        // Generate deployment recommendation
        const recommendations = this.generateRecommendations(analysis);
        return {
            analysis,
            data: {
                project: {
                    name: analysis.projectName,
                    path: analysis.projectPath,
                    confidence: analysis.confidence,
                },
                framework: {
                    name: analysis.framework.name,
                    version: analysis.framework.version,
                    type: analysis.framework.type,
                    runtime: analysis.framework.runtime,
                    framework: analysis.framework.framework,
                    packageManager: analysis.framework.packageManager,
                },
                services: {
                    database: analysis.services.database,
                    cache: analysis.services.cache,
                    storage: analysis.services.storage,
                    queue: analysis.services.queue,
                    websockets: analysis.services.websockets,
                    additionalServices: analysis.services.additionalServices,
                },
                buildConfig: {
                    installCommand: analysis.buildConfig.installCommand,
                    buildCommand: analysis.buildConfig.buildCommand,
                    startCommand: analysis.buildConfig.startCommand,
                    port: analysis.buildConfig.port,
                    healthCheckPath: analysis.buildConfig.healthCheckPath,
                    environmentType: analysis.buildConfig.environmentType,
                },
                deploymentDocs: {
                    hasDockerfile: analysis.deploymentDocs.hasDockerfile,
                    hasDockerCompose: analysis.deploymentDocs.hasDockerCompose,
                    hasTerraform: analysis.deploymentDocs.hasTerraform,
                    hasReadme: analysis.deploymentDocs.hasReadme,
                    hasDeploymentGuide: analysis.deploymentDocs.hasDeploymentGuide,
                    cicdPlatform: analysis.deploymentDocs.cicdConfig?.platform || undefined,
                    cicdConfigPath: analysis.deploymentDocs.cicdConfig?.configPath,
                    dockerComposeServices: analysis.deploymentDocs.dockerComposeServices,
                    terraformResources: analysis.deploymentDocs.terraformResources,
                },
                environmentVars: analysis.environmentVars.map(env => ({
                    key: env.key,
                    required: env.required,
                    example: env.example,
                    description: env.description,
                })),
                recommendations,
            },
        };
    }
    generateRecommendations(analysis) {
        const recommendations = [];
        const { framework, services, deploymentDocs } = analysis;
        // Docker-based recommendations
        if (deploymentDocs.hasDockerCompose) {
            recommendations.push('Use docker-compose.yml for AWS ECS deployment');
        }
        else if (deploymentDocs.hasDockerfile) {
            recommendations.push('Use existing Dockerfile for containerized deployment');
        }
        // Framework-specific recommendations
        if (!deploymentDocs.hasDockerfile && !deploymentDocs.hasDockerCompose) {
            switch (framework.framework) {
                case 'nextjs':
                    recommendations.push('Deploy to AWS ECS with Fargate (SSR support needed)');
                    break;
                case 'remix':
                    recommendations.push('Deploy to AWS ECS with Fargate or Lambda (depending on adapter)');
                    break;
                case 'react':
                case 'vue':
                case 'svelte':
                case 'angular':
                    recommendations.push('Static build → S3 + CloudFront (CDN)');
                    break;
                case 'express':
                case 'fastify':
                case 'nestjs':
                    if (services.database) {
                        recommendations.push('Deploy to AWS ECS Fargate with RDS');
                    }
                    else {
                        recommendations.push('Deploy to AWS Lambda (stateless API)');
                    }
                    break;
                case 'fastapi':
                case 'flask':
                    if (services.database) {
                        recommendations.push('Deploy to AWS ECS with RDS');
                    }
                    else {
                        recommendations.push('Deploy to AWS Lambda with container support');
                    }
                    break;
                case 'django':
                    recommendations.push('Deploy to AWS ECS with RDS (requires long-running server)');
                    break;
                case 'gin':
                case 'fiber':
                    recommendations.push('Deploy to AWS ECS or EC2 (Go binary)');
                    break;
                default:
                    recommendations.push('Deploy to AWS ECS Fargate (universal containerized deployment)');
            }
        }
        // Database recommendations
        if (services.database && !services.database.type.includes('sqlite')) {
            recommendations.push(`Configure ${services.database.type.toUpperCase()} database on AWS RDS`);
        }
        // Cache recommendations
        if (services.cache) {
            recommendations.push(`Set up ${services.cache.type.toUpperCase()} cache service (ElastiCache)`);
        }
        // Storage recommendations
        if (services.storage && services.storage.type === 's3') {
            recommendations.push('Configure S3 buckets for file storage');
        }
        if (recommendations.length === 0) {
            recommendations.push('Review project structure and configure deployment pipeline');
        }
        return recommendations;
    }
}
//# sourceMappingURL=service.js.map