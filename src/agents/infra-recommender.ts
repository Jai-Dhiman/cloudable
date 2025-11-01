import { BaseAgent, type AgentState } from './base-agent.js';
import type { InfrastructureRecommendation, DeploymentOption, AWSService } from '../types/infrastructure.js';

interface InstanceSizingConfig {
  minDAU: number;
  maxDAU: number;
  instanceType: string;
  description: string;
}

const INSTANCE_SIZING: InstanceSizingConfig[] = [
  { minDAU: 0, maxDAU: 100, instanceType: 't3.micro', description: 'Small workload' },
  { minDAU: 101, maxDAU: 1000, instanceType: 't3.small', description: 'Low to medium traffic' },
  { minDAU: 1001, maxDAU: 10000, instanceType: 't3.medium', description: 'Medium traffic' },
  { minDAU: 10001, maxDAU: 100000, instanceType: 't3.large', description: 'High traffic' },
  { minDAU: 100001, maxDAU: Infinity, instanceType: 't3.xlarge', description: 'Very high traffic' }
];

const DATABASE_SIZING: Record<string, Record<string, string>> = {
  postgresql: {
    small: 'db.t3.micro',
    medium: 'db.t3.small',
    large: 'db.t3.medium'
  },
  mysql: {
    small: 'db.t3.micro',
    medium: 'db.t3.small',
    large: 'db.t3.medium'
  },
  mongodb: {
    small: 't3.small',
    medium: 't3.medium',
    large: 't3.large'
  }
};

export class InfraRecommenderAgent extends BaseAgent {
  constructor() {
    super({
      name: 'infrastructure-recommender',
      instructions: `You are an AWS infrastructure expert. Based on code analysis and user requirements, you recommend the best AWS services and instance sizes.

Your recommendations should be:
1. Cost-effective (prefer VPC endpoints over NAT Gateway when possible)
2. Scalable (right-sized for expected traffic)
3. Secure (encrypted by default, minimal security groups)
4. Production-ready (include monitoring, backups, health checks)

Consider the detected framework, database requirements, and expected DAU when making recommendations.`,
      model: 'gpt-4o'
    });
  }

  async execute(state: AgentState): Promise<AgentState> {
    try {
      if (!state.codeAnalysis) {
        throw new Error('Code analysis required before infrastructure recommendation');
      }

      if (!state.userAnswers) {
        throw new Error('User answers required for infrastructure recommendation');
      }

      const useHyperspell = process.env.HYPERSPELL_APP_TOKEN;

      let recommendation: InfrastructureRecommendation;

      if (useHyperspell) {
        recommendation = await this.recommendWithHyperspell(state);
      } else {
        recommendation = await this.recommendWithRules(state);
      }

      return this.updateState(state, { infraRecommendation: recommendation });
    } catch (error) {
      const errorMessage = `Infrastructure recommendation failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`✗ ${errorMessage}`);
      return this.addError(state, errorMessage);
    }
  }

  private async recommendWithHyperspell(state: AgentState): Promise<InfrastructureRecommendation> {
    // TODO: Implement Hyperspell SDK integration when credentials are available
    // Query for similar deployment patterns based on framework and database
    // For now, use AI recommendations
    return this.recommendWithAI(state);
  }

  private async recommendWithAI(state: AgentState): Promise<InfrastructureRecommendation> {
    const { codeAnalysis, userAnswers } = state;

    if (!codeAnalysis || !userAnswers) {
      throw new Error('Missing required state');
    }

    // Build context for AI
    const prompt = `You are an AWS infrastructure expert. Based on this analysis, recommend the optimal AWS services:

**Code Analysis:**
- Framework: ${codeAnalysis.framework.framework} (${codeAnalysis.framework.runtime})
- Database: ${codeAnalysis.services.database?.type || 'none'}
- Cache: ${codeAnalysis.services.cache?.type || 'none'}
- Storage: ${codeAnalysis.services.storage?.type || 'none'}
- WebSockets: ${codeAnalysis.services.websockets?.required ? 'yes' : 'no'}

**Requirements:**
- Expected DAU: ${userAnswers.expectedDAU}
- Monthly Budget: $${userAnswers.budget}
- AWS Region: ${userAnswers.awsRegion}

**Cost Optimization Priorities:**
1. Use VPC endpoints instead of NAT Gateway when possible (saves $32/month)
2. Right-size instances based on DAU
3. Prefer managed services to reduce operational overhead

Provide recommendations as JSON:
{
  "instanceType": "t3.micro|t3.small|t3.medium|t3.large",
  "services": [
    {
      "name": "EC2 Instance (t3.small)",
      "type": "compute|database|storage|network|cache",
      "description": "Brief description",
      "configuration": { "instanceType": "t3.small", "replicas": 1 },
      "monthlyCost": 15
    }
  ],
  "totalCost": 55,
  "reasoning": "Explanation of choices",
  "costSavingTips": ["Use VPC endpoints", "Consider reserved instances"]
}`;

    // Use streaming with visible thinking
    const resultText = await this.generateWithThinking(prompt, {
      title: 'Planning optimal AWS infrastructure',
      showPrompt: false
    });

    // Parse AI response
    const aiRecommendation = this.parseAIResponse(resultText);

    // Build deployment option from AI response
    return this.buildDeploymentOption(aiRecommendation, codeAnalysis, userAnswers);
  }

  private parseAIResponse(text: string): any {
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }
      return JSON.parse(text);
    } catch (error) {
      console.warn('  AI response parsing failed, using fallback');
      return null;
    }
  }

  private buildDeploymentOption(aiRec: any, codeAnalysis: any, userAnswers: any): InfrastructureRecommendation {
    // If AI parsing failed, fall back to rule-based
    if (!aiRec) {
      return this.recommendWithRules({ codeAnalysis, userAnswers, projectId: '', projectPath: '', errors: [] });
    }

    // Use AI recommendations to build deployment option
    const projectType = codeAnalysis.framework.type === 'fullstack' ? 'fullstack' :
                       codeAnalysis.framework.type === 'api' ? 'backend' :
                       codeAnalysis.framework.type === 'web' ? 'frontend' : 'fullstack';

    const totalCost = aiRec.services.reduce((sum: number, s: any) => sum + (s.monthlyCost || 0), 0);

    const deploymentOption: DeploymentOption = {
      name: 'AI-Optimized AWS Deployment',
      description: `${aiRec.services.length} AWS services optimized for ${codeAnalysis.framework.framework}`,
      services: aiRec.services,
      estimatedCost: {
        monthly: Math.round(totalCost),
        breakdown: {
          compute: aiRec.services.filter((s: any) => s.type === 'compute').reduce((sum: number, s: any) => sum + s.monthlyCost, 0),
          database: aiRec.services.filter((s: any) => s.type === 'database').reduce((sum: number, s: any) => sum + s.monthlyCost, 0),
          storage: aiRec.services.filter((s: any) => s.type === 'storage').reduce((sum: number, s: any) => sum + s.monthlyCost, 0),
          network: aiRec.services.filter((s: any) => s.type === 'network').reduce((sum: number, s: any) => sum + s.monthlyCost, 0),
          cache: aiRec.services.filter((s: any) => s.type === 'cache').reduce((sum: number, s: any) => sum + s.monthlyCost, 0)
        },
        currency: 'USD'
      },
      difficulty: 'medium',
      setupTime: '10-15 minutes',
      pros: aiRec.costSavingTips || [
        'AI-optimized for your specific workload',
        'Cost-effective instance sizing',
        'Managed services reduce operational overhead'
      ],
      cons: [
        totalCost > userAnswers.budget ? `Estimated cost ($${totalCost}/mo) exceeds budget ($${userAnswers.budget}/mo)` : 'Requires AWS account setup',
        'Manual CI/CD configuration needed'
      ],
      bestFor: `${codeAnalysis.framework.framework} applications with ${userAnswers.expectedDAU} DAU`
    };

    return {
      projectType,
      recommendations: [deploymentOption],
      recommended: deploymentOption,
      reasoning: aiRec.reasoning || 'AI-generated infrastructure recommendations based on your codebase analysis'
    };
  }

  private recommendWithRules(state: AgentState): InfrastructureRecommendation {
    const { codeAnalysis, userAnswers } = state;

    if (!codeAnalysis || !userAnswers) {
      throw new Error('Missing required state');
    }

    const dau = userAnswers.expectedDAU;
    const budget = userAnswers.budget;
    const region = userAnswers.awsRegion;

    // Determine instance size based on DAU
    const instanceConfig = this.getInstanceSize(dau);

    // Build services list
    const services: AWSService[] = [];

    // 1. Compute (EC2)
    const computeCost = this.estimateEC2Cost(instanceConfig.instanceType, region);
    services.push({
      name: `EC2 Instance (${instanceConfig.instanceType})`,
      type: 'compute',
      description: `Application server for ${codeAnalysis.framework.framework} - ${instanceConfig.description}`,
      configuration: {
        instanceType: instanceConfig.instanceType,
        replicas: dau > 10000 ? 2 : 1,
        autoScaling: dau > 10000
      },
      monthlyCost: computeCost
    });

    // 2. Database (RDS or DocumentDB)
    if (codeAnalysis.services.database && codeAnalysis.services.database.type) {
      const dbSize = this.getDatabaseSize(dau);
      const dbInstanceClass = DATABASE_SIZING[codeAnalysis.services.database.type]?.[dbSize] || 'db.t3.micro';
      const dbCost = this.estimateRDSCost(dbInstanceClass, region);

      services.push({
        name: `RDS ${codeAnalysis.services.database.type.toUpperCase()}`,
        type: 'database',
        description: `Managed ${codeAnalysis.services.database.type} database`,
        configuration: {
          instanceType: dbInstanceClass,
          storage: dbSize === 'large' ? 100 : dbSize === 'medium' ? 50 : 20,
          multiAZ: dau > 10000,
          backups: true
        },
        monthlyCost: dbCost
      });
    }

    // 3. Storage (S3)
    if (codeAnalysis.services.storage) {
      services.push({
        name: 'S3 Bucket',
        type: 'storage',
        description: 'Object storage for files and assets',
        configuration: {
          encryption: true,
          versioning: true,
          lifecycle: true
        },
        monthlyCost: 5 // Estimate for small usage
      });
    }

    // 4. Cache (ElastiCache)
    if (codeAnalysis.services.cache) {
      const cacheCost = 15; // t3.micro ElastiCache
      services.push({
        name: 'ElastiCache Redis',
        type: 'cache',
        description: 'In-memory caching',
        configuration: {
          instanceType: 'cache.t3.micro',
          replicas: 1
        },
        monthlyCost: cacheCost
      });
    }

    // 5. Networking (VPC)
    const needsNAT = !codeAnalysis.services.storage; // Only need NAT if not using S3 with VPC endpoint
    const networkCost = needsNAT ? 32 : 0; // NAT Gateway cost

    services.push({
      name: 'VPC with Security Groups',
      type: 'network',
      description: needsNAT
        ? 'Virtual Private Cloud with NAT Gateway for internet access'
        : 'Virtual Private Cloud with VPC Endpoints (cost-optimized)',
      configuration: {
        cidr: '10.0.0.0/16',
        availabilityZones: 2,
        natGateway: needsNAT,
        vpcEndpoints: codeAnalysis.services.storage ? ['s3'] : []
      },
      monthlyCost: networkCost
    });

    // Calculate total cost
    const totalCost = services.reduce((sum, service) => sum + service.monthlyCost, 0);

    // Determine project type
    const projectType = codeAnalysis.framework.type === 'fullstack' ? 'fullstack' :
                       codeAnalysis.framework.type === 'api' ? 'backend' :
                       codeAnalysis.framework.type === 'web' ? 'frontend' : 'fullstack';

    // Create deployment option
    const deploymentOption: DeploymentOption = {
      name: 'AWS EC2 with Managed Services',
      description: `EC2-based deployment with ${services.length} AWS services`,
      services,
      estimatedCost: {
        monthly: Math.round(totalCost),
        breakdown: {
          compute: services.filter(s => s.type === 'compute').reduce((sum, s) => sum + s.monthlyCost, 0),
          database: services.filter(s => s.type === 'database').reduce((sum, s) => sum + s.monthlyCost, 0),
          storage: services.filter(s => s.type === 'storage').reduce((sum, s) => sum + s.monthlyCost, 0),
          network: services.filter(s => s.type === 'network').reduce((sum, s) => sum + s.monthlyCost, 0),
          cache: services.filter(s => s.type === 'cache').reduce((sum, s) => sum + s.monthlyCost, 0)
        },
        currency: 'USD'
      },
      difficulty: 'medium',
      setupTime: '10-15 minutes',
      pros: [
        'Fully managed services reduce operational overhead',
        'Auto-scaling capable for traffic spikes',
        'Built-in backups and disaster recovery',
        needsNAT ? 'Internet access for EC2 instances' : 'Cost-optimized with VPC endpoints'
      ],
      cons: [
        totalCost > budget ? `Estimated cost ($${totalCost}/mo) exceeds budget ($${budget}/mo)` : 'Requires AWS account setup',
        'Manual configuration needed for CI/CD',
        needsNAT ? 'NAT Gateway adds $32/month - consider VPC endpoints' : 'Limited to VPC endpoint-compatible services'
      ],
      bestFor: `${codeAnalysis.framework.framework} applications with ${dau} DAU expecting ${instanceConfig.description}`
    };

    // Generate reasoning
    const reasoning = this.generateReasoning(codeAnalysis, userAnswers, deploymentOption);

    return {
      projectType,
      recommendations: [deploymentOption],
      recommended: deploymentOption,
      reasoning
    };
  }

  private getInstanceSize(dau: number): InstanceSizingConfig {
    return INSTANCE_SIZING.find(config => dau >= config.minDAU && dau <= config.maxDAU) || INSTANCE_SIZING[0];
  }

  private getDatabaseSize(dau: number): 'small' | 'medium' | 'large' {
    if (dau < 1000) return 'small';
    if (dau < 10000) return 'medium';
    return 'large';
  }

  private estimateEC2Cost(instanceType: string, region: string): number {
    // Simplified pricing (US East 1, on-demand, monthly)
    const pricing: Record<string, number> = {
      't3.micro': 7.5,
      't3.small': 15,
      't3.medium': 30,
      't3.large': 60,
      't3.xlarge': 120
    };

    return pricing[instanceType] || 30;
  }

  private estimateRDSCost(instanceClass: string, region: string): number {
    // Simplified RDS pricing (US East 1, on-demand, monthly)
    const pricing: Record<string, number> = {
      'db.t3.micro': 12,
      'db.t3.small': 25,
      'db.t3.medium': 50,
      'db.t3.large': 100,
      't3.small': 15, // For MongoDB on EC2
      't3.medium': 30,
      't3.large': 60
    };

    return pricing[instanceClass] || 25;
  }

  private generateReasoning(codeAnalysis: any, userAnswers: any, option: DeploymentOption): string {
    const parts: string[] = [];

    parts.push(`Selected EC2-based deployment for ${codeAnalysis.framework.framework} application.`);

    if (codeAnalysis.services.database) {
      parts.push(`RDS ${codeAnalysis.services.database.type} chosen for managed database with automatic backups.`);
    }

    if (codeAnalysis.services.storage) {
      parts.push(`S3 for object storage with VPC endpoint to reduce costs.`);
    }

    parts.push(`Instance sizing based on ${userAnswers.expectedDAU} expected daily active users.`);

    if (option.estimatedCost.monthly > userAnswers.budget) {
      parts.push(`⚠️  Estimated cost exceeds budget. Consider: reducing instance sizes, using reserved instances, or removing optional services.`);
    }

    return parts.join(' ');
  }
}

export async function executeInfraRecommender(state: AgentState): Promise<AgentState> {
  const agent = new InfraRecommenderAgent();
  return agent.execute(state);
}
