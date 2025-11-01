export interface InfrastructureRecommendation {
  projectType: 'frontend' | 'backend' | 'fullstack' | 'static'
  recommendations: DeploymentOption[]
  recommended: DeploymentOption // Best option
  reasoning: string
}

export interface DeploymentOption {
  name: string
  description: string
  services: AWSService[]
  estimatedCost: CostEstimate
  difficulty: 'easy' | 'medium' | 'hard'
  setupTime: string // e.g., "10 minutes"
  pros: string[]
  cons: string[]
  bestFor: string
}

export interface AWSService {
  name: string
  type: 'compute' | 'database' | 'storage' | 'network' | 'cache' | 'other'
  description: string
  configuration: {
    instanceType?: string
    size?: string
    replicas?: number
    [key: string]: any
  }
  monthlyCost: number
}

export interface CostEstimate {
  monthly: number
  breakdown: {
    compute: number
    database?: number
    storage?: number
    network?: number
    cache?: number
    other?: number
  }
  currency: 'USD'
}

export interface InfrastructureRecommenderOptions {
  budget?: number // monthly budget in USD
  priority?: 'cost' | 'performance' | 'ease'
  region?: string
}

