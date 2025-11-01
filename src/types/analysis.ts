export interface ProjectAnalysis {
  projectPath: string
  projectName: string
  
  // Deployment documentation found
  deploymentDocs: DeploymentDocs
  
  // Framework detection
  framework: FrameworkDetection
  
  // Services needed
  services: ServiceRequirements
  
  // Build/Run configuration
  buildConfig: BuildConfig
  
  // Environment variables
  environmentVars: EnvironmentVar[]
  
  // Confidence score (0-100)
  confidence: number
}

export interface DeploymentDocs {
  hasDockerfile: boolean
  hasDockerCompose: boolean
  hasTerraform: boolean
  hasReadme: boolean
  hasDeploymentGuide: boolean
  cicdConfig?: {
    platform: 'github-actions' | 'gitlab-ci' | 'circleci' | 'jenkins' | null
    configPath?: string
  }
  dockerComposeServices?: string[]
  terraformResources?: string[]
}

export interface FrameworkDetection {
  name: string
  version?: string
  type: 'web' | 'api' | 'fullstack' | 'static' | 'mobile' | 'unknown'
  runtime: 'node' | 'python' | 'go' | 'ruby' | 'php' | 'java' | 'rust' | 'dotnet' | 'unknown'
  
  // Specific framework detected
  framework: 
    | 'nextjs' 
    | 'remix' 
    | 'react' 
    | 'vue' 
    | 'angular' 
    | 'svelte'
    | 'express' 
    | 'fastify' 
    | 'nestjs'
    | 'django' 
    | 'fastapi' 
    | 'flask'
    | 'rails'
    | 'laravel'
    | 'gin'
    | 'fiber'
    | 'unknown'
  
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'poetry' | 'go' | 'cargo'
}

export interface ServiceRequirements {
  database?: {
    type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite' | 'redis' | 'dynamodb'
    required: boolean
    detectedFrom: string // e.g., "package.json dependencies"
  }
  cache?: {
    type: 'redis' | 'memcached'
    required: boolean
    detectedFrom: string
  }
  storage?: {
    type: 's3' | 'gcs' | 'azure-blob' | 'local'
    required: boolean
    detectedFrom: string
  }
  queue?: {
    type: 'rabbitmq' | 'sqs' | 'redis' | 'kafka'
    required: boolean
    detectedFrom: string
  }
  websockets?: {
    required: boolean
    detectedFrom: string
  }
  additionalServices: string[]
}

export interface BuildConfig {
  buildCommand?: string
  startCommand?: string
  installCommand?: string
  port?: number
  healthCheckPath?: string
  environmentType: 'development' | 'production' | 'unknown'
}

export interface EnvironmentVar {
  key: string
  required: boolean
  example?: string
  description?: string
}

export interface AnalyzerOptions {
  deep?: boolean // Deep analysis using AI
  verbose?: boolean
}

