import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'
import * as yaml from 'js-yaml'
import type {DeploymentDocs} from '../types/analysis.js'

export class DeploymentScanner {
  constructor(private projectPath: string) {}

  async scan(): Promise<DeploymentDocs> {
    const docs: DeploymentDocs = {
      hasDockerfile: false,
      hasDockerCompose: false,
      hasTerraform: false,
      hasReadme: false,
      hasDeploymentGuide: false,
      cicdConfig: {platform: null},
      dockerComposeServices: [],
      terraformResources: [],
    }

    // Check for Docker files
    docs.hasDockerfile = this.fileExists('Dockerfile')
    docs.hasDockerCompose = this.fileExists('docker-compose.yml') || this.fileExists('docker-compose.yaml')

    // Parse docker-compose if exists
    if (docs.hasDockerCompose) {
      docs.dockerComposeServices = this.parseDockerCompose()
    }

    // Check for Terraform
    docs.hasTerraform = this.directoryExists('terraform') || this.hasFilesWithExtension('.tf')
    if (docs.hasTerraform) {
      docs.terraformResources = this.listTerraformFiles()
    }

    // Check for README files
    docs.hasReadme = this.fileExists('README.md') || 
                     this.fileExists('README.txt') || 
                     this.fileExists('README')

    // Check for deployment guides
    docs.hasDeploymentGuide = this.fileExists('DEPLOY.md') ||
                              this.fileExists('DEPLOYMENT.md') ||
                              this.hasDeploymentInReadme()

    // Check for CI/CD configurations
    docs.cicdConfig = this.detectCICDConfig()

    return docs
  }

  private fileExists(filename: string): boolean {
    return existsSync(join(this.projectPath, filename))
  }

  private directoryExists(dirname: string): boolean {
    const path = join(this.projectPath, dirname)
    return existsSync(path) && statSync(path).isDirectory()
  }

  private hasFilesWithExtension(ext: string): boolean {
    try {
      const files = readdirSync(this.projectPath)
      return files.some(file => file.endsWith(ext))
    } catch {
      return false
    }
  }

  private parseDockerCompose(): string[] {
    const services: string[] = []
    
    try {
      const composeFile = this.fileExists('docker-compose.yml') 
        ? 'docker-compose.yml' 
        : 'docker-compose.yaml'
      
      const content = readFileSync(join(this.projectPath, composeFile), 'utf-8')
      const parsed = yaml.load(content) as any
      
      if (parsed?.services) {
        services.push(...Object.keys(parsed.services))
      }
    } catch (error) {
      // Ignore parsing errors
    }
    
    return services
  }

  private listTerraformFiles(): string[] {
    const tfFiles: string[] = []
    
    try {
      const terraformDir = join(this.projectPath, 'terraform')
      
      if (existsSync(terraformDir)) {
        const files = readdirSync(terraformDir)
        tfFiles.push(...files.filter(f => f.endsWith('.tf')))
      } else {
        // Check root directory
        const files = readdirSync(this.projectPath)
        tfFiles.push(...files.filter(f => f.endsWith('.tf')))
      }
    } catch {
      // Ignore errors
    }
    
    return tfFiles
  }

  private hasDeploymentInReadme(): boolean {
    try {
      const readmeFile = this.fileExists('README.md') ? 'README.md' : 
                         this.fileExists('README.txt') ? 'README.txt' : 'README'
      
      if (!this.fileExists(readmeFile)) return false
      
      const content = readFileSync(join(this.projectPath, readmeFile), 'utf-8').toLowerCase()
      
      // Look for deployment-related sections
      return content.includes('## deploy') ||
             content.includes('# deploy') ||
             content.includes('## deployment') ||
             content.includes('# deployment') ||
             content.includes('getting started') ||
             content.includes('installation')
    } catch {
      return false
    }
  }

  private detectCICDConfig(): DeploymentDocs['cicdConfig'] {
    // GitHub Actions
    if (this.directoryExists('.github/workflows')) {
      return {
        platform: 'github-actions',
        configPath: '.github/workflows',
      }
    }

    // GitLab CI
    if (this.fileExists('.gitlab-ci.yml')) {
      return {
        platform: 'gitlab-ci',
        configPath: '.gitlab-ci.yml',
      }
    }

    // CircleCI
    if (this.fileExists('.circleci/config.yml')) {
      return {
        platform: 'circleci',
        configPath: '.circleci/config.yml',
      }
    }

    // Jenkins
    if (this.fileExists('Jenkinsfile')) {
      return {
        platform: 'jenkins',
        configPath: 'Jenkinsfile',
      }
    }

    return {platform: null}
  }
}

