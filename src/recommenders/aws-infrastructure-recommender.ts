export class AWSInfrastructureRecommender {
    analysis;
    options;
    constructor(analysis: any, options: any = {}) {
        this.analysis = analysis;
        this.options = options;
    }
    recommend() {
        const projectType = this.determineProjectType();
        const recommendations = this.generateRecommendations(projectType);
        // Sort by priority
        const sortedRecommendations = this.sortByPriority(recommendations);
        return {
            projectType,
            recommendations: sortedRecommendations,
            recommended: sortedRecommendations[0],
            reasoning: this.generateReasoning(projectType, sortedRecommendations[0]),
        };
    }
    determineProjectType() {
        const { framework } = this.analysis;
        // Static sites (React SPA, Vue, etc.)
        if (['react', 'vue', 'angular', 'svelte'].includes(framework.framework) &&
            !this.analysis.services.database) {
            return 'static';
        }
        // Fullstack frameworks
        if (['nextjs', 'remix', 'django', 'rails', 'laravel'].includes(framework.framework)) {
            return 'fullstack';
        }
        // Backend APIs
        if (['express', 'fastify', 'nestjs', 'fastapi', 'flask', 'gin', 'fiber'].includes(framework.framework)) {
            return 'backend';
        }
        // Default
        return framework.type;
    }
    generateRecommendations(projectType: any) {
        switch (projectType) {
            case 'static': {
                return this.getStaticSiteRecommendations();
            }
            case 'frontend':
            case 'fullstack': {
                return this.getFullstackRecommendations();
            }
            case 'backend': {
                return this.getBackendRecommendations();
            }
            default: {
                return this.getFullstackRecommendations();
            }
        }
    }
    getStaticSiteRecommendations() {
        return [
            {
                name: 'S3 + CloudFront (Cheapest)',
                description: 'Static hosting with CDN for global performance',
                services: [
                    {
                        name: 'S3 Bucket',
                        type: 'storage',
                        description: 'Static file hosting',
                        configuration: { size: '1GB' },
                        monthlyCost: 0.023,
                    },
                    {
                        name: 'CloudFront CDN',
                        type: 'network',
                        description: 'Global content delivery',
                        configuration: { dataTransfer: '50GB' },
                        monthlyCost: 4.25,
                    },
                ],
                estimatedCost: {
                    monthly: 5,
                    breakdown: {
                        storage: 0.023,
                        network: 4.25,
                        compute: 0,
                    },
                    currency: 'USD',
                },
                difficulty: 'easy',
                setupTime: '5 minutes',
                pros: [
                    'Extremely cheap (~$5/month)',
                    'Auto-scales to millions of users',
                    'No server management',
                    'Built-in CDN',
                ],
                cons: ['Static only (no SSR)', 'No backend logic'],
                bestFor: 'Landing pages, portfolios, documentation sites',
            },
            {
                name: 'Amplify Hosting',
                description: 'Managed static hosting with CI/CD built-in',
                services: [
                    {
                        name: 'AWS Amplify',
                        type: 'compute',
                        description: 'Managed hosting with build pipeline',
                        configuration: { buildMinutes: 100, hosting: '5GB' },
                        monthlyCost: 1,
                    },
                ],
                estimatedCost: {
                    monthly: 1,
                    breakdown: { compute: 0.01, storage: 0.15, network: 0.84 },
                    currency: 'USD',
                },
                difficulty: 'easy',
                setupTime: '5 minutes',
                pros: ['Free tier available', 'Auto CI/CD from Git', 'Custom domains easy', 'Preview environments'],
                cons: ['Paid after free tier', 'Less control'],
                bestFor: 'Quick deployments, Git-based workflows',
            },
        ];
    }
    getFullstackRecommendations() {
        const hasDatabase = !!this.analysis.services.database;
        const hasCache = !!this.analysis.services.cache;
        const options = [
            // Option 1: EC2 (Cheapest)
            {
                name: 'EC2 t3.micro (Cheapest)',
                description: 'Single small VM running your app with Docker',
                services: [
                    {
                        name: 'EC2 t3.micro',
                        type: 'compute',
                        description: '1 vCPU, 1GB RAM',
                        configuration: {
                            instanceType: 't3.micro',
                            vcpu: 1,
                            ram: '1GB',
                        },
                        monthlyCost: 7.5,
                    },
                    ...(hasDatabase
                        ? [
                            {
                                name: 'RDS t4g.micro',
                                type: 'database',
                                description: 'PostgreSQL database',
                                configuration: {
                                    instanceType: 'db.t4g.micro',
                                    storage: '20GB',
                                },
                                monthlyCost: 12.5,
                            },
                        ]
                        : []),
                ],
                estimatedCost: {
                    monthly: hasDatabase ? 20 : 7.5,
                    breakdown: {
                        compute: 7.5,
                        database: hasDatabase ? 12.5 : 0,
                    },
                    currency: 'USD',
                },
                difficulty: 'medium',
                setupTime: '20 minutes',
                pros: ['Super cheap (~$8-20/month)', 'Full control', 'Good for low traffic'],
                cons: ['Manual scaling', 'Single point of failure', 'You manage updates'],
                bestFor: 'MVPs, side projects, low-traffic apps (<1000 users/day)',
            },
            // Option 2: ECS Fargate (Recommended)
            {
                name: 'ECS Fargate (Recommended)',
                description: 'Managed containers - easy, scalable, production-ready',
                services: [
                    {
                        name: 'ECS Fargate',
                        type: 'compute',
                        description: '0.5 vCPU, 1GB RAM',
                        configuration: {
                            cpu: '512',
                            memory: '1024',
                            replicas: 1,
                        },
                        monthlyCost: 15,
                    },
                    {
                        name: 'Application Load Balancer',
                        type: 'network',
                        description: 'HTTPS load balancer',
                        configuration: {},
                        monthlyCost: 16,
                    },
                    ...(hasDatabase
                        ? [
                            {
                                name: 'RDS t4g.micro',
                                type: 'database',
                                description: 'PostgreSQL database',
                                configuration: {
                                    instanceType: 'db.t4g.micro',
                                    storage: '20GB',
                                },
                                monthlyCost: 12.5,
                            },
                        ]
                        : []),
                    ...(hasCache
                        ? [
                            {
                                name: 'ElastiCache t3.micro',
                                type: 'cache',
                                description: 'Redis cache',
                                configuration: {
                                    instanceType: 'cache.t3.micro',
                                },
                                monthlyCost: 11,
                            },
                        ]
                        : []),
                ],
                estimatedCost: {
                    monthly: 31 + (hasDatabase ? 12.5 : 0) + (hasCache ? 11 : 0),
                    breakdown: {
                        compute: 15,
                        network: 16,
                        database: hasDatabase ? 12.5 : 0,
                        cache: hasCache ? 11 : 0,
                    },
                    currency: 'USD',
                },
                difficulty: 'easy',
                setupTime: '15 minutes',
                pros: [
                    'No server management',
                    'Auto-scaling built-in',
                    'Production-ready',
                    'Easy updates (rolling)',
                    'Load balancer included',
                ],
                cons: ['More expensive than EC2', 'Requires containerization'],
                bestFor: 'Production apps, startups, anything that needs to scale',
            },
            // Option 3: App Runner (Easiest)
            {
                name: 'App Runner (Easiest)',
                description: 'Simplest deployment - just point to code and go',
                services: [
                    {
                        name: 'AWS App Runner',
                        type: 'compute',
                        description: 'Fully managed service',
                        configuration: {
                            cpu: '1 vCPU',
                            memory: '2GB',
                        },
                        monthlyCost: 25,
                    },
                ],
                estimatedCost: {
                    monthly: 25,
                    breakdown: {
                        compute: 25,
                    },
                    currency: 'USD',
                },
                difficulty: 'easy',
                setupTime: '5 minutes',
                pros: [
                    'Easiest setup',
                    'Auto-scales from zero',
                    'Built-in load balancer',
                    'HTTPS automatically',
                    'No container knowledge needed',
                ],
                cons: ['Most expensive option', 'Cannot add database easily', 'Less customization'],
                bestFor: 'Quick MVPs, simple apps without databases',
            },
        ];
        return options;
    }
    getBackendRecommendations() {
        const hasDatabase = !!this.analysis.services.database;
        return [
            // Lambda for stateless APIs
            {
                name: 'Lambda + API Gateway (Cheapest)',
                description: 'Serverless functions - pay only when used',
                services: [
                    {
                        name: 'AWS Lambda',
                        type: 'compute',
                        description: 'Serverless functions',
                        configuration: {
                            memory: '512MB',
                            requests: '100K/month',
                        },
                        monthlyCost: 0.2,
                    },
                    {
                        name: 'API Gateway',
                        type: 'network',
                        description: 'API endpoint',
                        configuration: {
                            requests: '100K/month',
                        },
                        monthlyCost: 0.35,
                    },
                    ...(hasDatabase
                        ? [
                            {
                                name: 'RDS t4g.micro',
                                type: 'database',
                                description: 'PostgreSQL database',
                                configuration: {
                                    instanceType: 'db.t4g.micro',
                                    storage: '20GB',
                                },
                                monthlyCost: 12.5,
                            },
                        ]
                        : []),
                ],
                estimatedCost: {
                    monthly: hasDatabase ? 13 : 0.55,
                    breakdown: {
                        compute: 0.2,
                        network: 0.35,
                        database: hasDatabase ? 12.5 : 0,
                    },
                    currency: 'USD',
                },
                difficulty: 'medium',
                setupTime: '30 minutes',
                pros: [
                    'Extremely cheap at low scale',
                    'Auto-scales infinitely',
                    'Pay per request',
                    'No server management',
                ],
                cons: ['Cold starts (200-500ms)', 'Complex for beginners', '15 minute timeout'],
                bestFor: 'APIs, webhooks, event-driven workloads',
            },
            // ECS for stateful backends
            ...this.getFullstackRecommendations().filter(opt => opt.name !== 'App Runner (Easiest)'),
        ];
    }
    sortByPriority(options: any) {
        const priority = this.options.priority || 'ease';
        if (priority === 'cost') {
            return options.sort((a: any, b: any) => a.estimatedCost.monthly - b.estimatedCost.monthly);
        }
        if (priority === 'ease') {
            const difficultyScore: any = { easy: 1, medium: 2, hard: 3 };
            return options.sort((a: any, b: any) => difficultyScore[a.difficulty] - difficultyScore[b.difficulty]);
        }
        if (priority === 'performance') {
            // ECS/EC2 first, then Lambda
            return options.sort((a: any, b: any) => {
                if (a.name.includes('ECS'))
                    return -1;
                if (b.name.includes('ECS'))
                    return 1;
                return 0;
            });
        }
        return options;
    }
    generateReasoning(projectType: any, recommended: any) {
        const { framework, services } = this.analysis;
        let reasoning = `Based on your ${framework.name} ${projectType} app, `;
        if (projectType === 'static') {
            reasoning += `we recommend ${recommended.name} because static sites don't need servers. `;
            reasoning += `You'll get fast loading times with CloudFront CDN for just $5/month.`;
            return reasoning;
        }
        if (projectType === 'fullstack') {
            reasoning += `we recommend ${recommended.name}. `;
            if (recommended.name.includes('ECS')) {
                reasoning += `ECS Fargate is the sweet spot: easy to manage, scales automatically, and production-ready. `;
                if (services.database) {
                    reasoning += `We'll add RDS for your database. `;
                }
                if (services.cache) {
                    reasoning += `Plus ElastiCache for Redis. `;
                }
                reasoning += `Total cost: ~$${recommended.estimatedCost.monthly}/month.`;
            }
            else if (recommended.name.includes('EC2')) {
                reasoning += `EC2 is the cheapest option at ~$${recommended.estimatedCost.monthly}/month. `;
                reasoning += `Good for MVPs and low-traffic apps, but you'll need to manage updates yourself.`;
            }
            return reasoning;
        }
        if (projectType === 'backend') {
            if (services.database) {
                reasoning += `we recommend ECS Fargate because your API needs a database connection. `;
                reasoning += `Lambda cold starts can cause database connection issues.`;
            }
            else {
                reasoning += `we recommend Lambda for a serverless, pay-per-request model. `;
                reasoning += `Perfect for APIs with variable traffic.`;
            }
        }
        return reasoning;
    }
}
//# sourceMappingURL=aws-infrastructure-recommender.js.map