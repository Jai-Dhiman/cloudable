import { Args, Command, Flags } from '@oclif/core';
import { resolve } from 'node:path';
import ora from 'ora';
import { ProjectAnalyzer } from '../analyzers/project-analyzer.js';
import { AWSInfrastructureRecommender } from '../recommenders/aws-infrastructure-recommender.js';
import { aiHelper } from '../utils/ai-helper.js';
export default class Recommend extends Command {
    static description = 'Get AWS infrastructure recommendations for your project';
    static examples = [
        '<%= config.bin %> <%= command.id %>',
        '<%= config.bin %> <%= command.id %> /path/to/project',
        '<%= config.bin %> <%= command.id %> --priority cost',
        '<%= config.bin %> <%= command.id %> --budget 50',
    ];
    static flags = {
        priority: Flags.string({
            char: 'p',
            description: 'Optimization priority',
            options: ['cost', 'ease', 'performance'],
            default: 'ease',
        }),
        budget: Flags.integer({
            char: 'b',
            description: 'Monthly budget in USD',
        }),
        region: Flags.string({
            char: 'r',
            description: 'AWS region',
            default: 'us-east-1',
        }),
        all: Flags.boolean({
            char: 'a',
            description: 'Show all options (not just recommended)',
            default: false,
        }),
    };
    static args = {
        path: Args.string({
            description: 'Path to the project directory',
            required: false,
            default: '.',
        }),
    };
    async run() {
        const { args, flags } = await this.parse(Recommend);
        const projectPath = resolve(args.path);
        this.log(`\nAnalyzing project at: ${projectPath}\n`);
        try {
            // Step 1: Analyze the project
            const spinner = ora('Scanning codebase...').start();
            const analyzer = new ProjectAnalyzer(projectPath);
            const analysis = await analyzer.analyze();
            spinner.succeed('Analysis complete');
            // Display analysis results first
            this.displayAnalysis(analysis);
            // Step 2: Get infrastructure recommendations
            const spinner2 = ora('Generating infrastructure recommendations...').start();
            const recommender = new AWSInfrastructureRecommender(analysis, {
                priority: flags.priority,
                budget: flags.budget,
                region: flags.region,
            });
            const recommendation = recommender.recommend();
            spinner2.succeed('Recommendations ready');
            // Display recommendations
            this.displayRecommendation(recommendation, flags.all);
            // AI-powered recommendation
            if (aiHelper.isEnabled()) {
                const aiSpinner = ora('Getting AI recommendation...').start();
                const aiRecommendation = await aiHelper.getInfrastructureRecommendation(analysis);
                aiSpinner.succeed('AI recommendation ready');
                this.log('\nAI-Powered Recommendation:');
                this.log(`${aiRecommendation}\n`);
            }
        }
        catch (error) {
            this.error(`Failed to generate recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    displayAnalysis(analysis: any) {
        this.log(`\nProject: ${analysis.projectName}`);
        this.log(`Framework: ${analysis.framework.name} ${analysis.framework.version || ''}`);
        this.log(`Runtime: ${analysis.framework.runtime}`);
        if (analysis.services.database) {
            this.log(`Database: ${analysis.services.database.type}`);
        }
        if (analysis.services.cache) {
            this.log(`Cache: ${analysis.services.cache.type}`);
        }
        if (analysis.services.storage) {
            this.log(`Storage: ${analysis.services.storage.type}`);
        }
        if (analysis.buildConfig.port) {
            this.log(`Port: ${analysis.buildConfig.port}`);
        }
        this.log(`Confidence: ${analysis.confidence}%\n`);
        this.log('─'.repeat(60));
        this.log('');
    }
    displayRecommendation(recommendation: any, showAll: any) {
        this.log(`\nProject Type: ${recommendation.projectType.toUpperCase()}\n`);
        // Show recommended option first
        this.log('RECOMMENDED DEPLOYMENT\n');
        this.displayOption(recommendation.recommended, true);
        this.log(`\nWhy this recommendation?`);
        this.log(`${recommendation.reasoning}\n`);
        // Show other options if requested
        if (showAll && recommendation.recommendations.length > 1) {
            this.log('\nOTHER OPTIONS\n');
            for (const option of recommendation.recommendations) {
                if (option.name !== recommendation.recommended.name) {
                    this.displayOption(option, false);
                    this.log('');
                }
            }
        }
        else if (recommendation.recommendations.length > 1) {
            this.log(`\n${recommendation.recommendations.length - 1} other option(s) available. Use --all to see them.\n`);
        }
    }
    displayOption(option: any, isRecommended: any) {
        const marker = isRecommended ? '[RECOMMENDED]' : '';
        this.log(`${option.name} ${marker}`);
        this.log(`   ${option.description}`);
        this.log(`   Difficulty: ${option.difficulty.toUpperCase()}`);
        this.log(`   Setup Time: ${option.setupTime}`);
        this.log(`   Cost: $${option.estimatedCost.monthly}/month`);
        this.log('');
        this.log('   AWS Services:');
        for (const service of option.services) {
            this.log(`   - ${service.name} - $${service.monthlyCost}/month`);
            if (service.configuration.instanceType) {
                this.log(`     (${service.configuration.instanceType})`);
            }
        }
        this.log('');
        this.log('   Pros:');
        for (const pro of option.pros) {
            this.log(`   + ${pro}`);
        }
        if (option.cons.length > 0) {
            this.log('');
            this.log('   Cons:');
            for (const con of option.cons) {
                this.log(`   - ${con}`);
            }
        }
        this.log('');
        this.log(`   Best for: ${option.bestFor}`);
    }
}
//# sourceMappingURL=recommend.js.map