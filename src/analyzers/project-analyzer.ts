import {basename} from 'node:path'
import type {AnalyzerOptions, ProjectAnalysis} from '../types/analysis.js'
import {BuildConfigDetector} from './build-config-detector.js'
import {DeploymentScanner} from './deployment-scanner.js'
import {FrameworkDetector} from './framework-detector.js'
import {ServiceDetector} from './service-detector.js'

export class ProjectAnalyzer {
  private deploymentScanner: DeploymentScanner
  private frameworkDetector: FrameworkDetector
  private serviceDetector: ServiceDetector
  private buildConfigDetector: BuildConfigDetector

  constructor(private projectPath: string) {
    this.deploymentScanner = new DeploymentScanner(projectPath)
    this.frameworkDetector = new FrameworkDetector(projectPath)
    this.serviceDetector = new ServiceDetector(projectPath)
    this.buildConfigDetector = new BuildConfigDetector(projectPath)
  }

  async analyze(options: AnalyzerOptions = {}): Promise<ProjectAnalysis> {
    // Run all analyzers in parallel
    const [deploymentDocs, framework, services, buildConfig, environmentVars] = await Promise.all([
      this.deploymentScanner.scan(),
      this.frameworkDetector.detect(),
      this.serviceDetector.detect(),
      this.buildConfigDetector.detectBuildConfig(),
      this.buildConfigDetector.detectEnvironmentVars(),
    ])

    // Calculate confidence score
    const confidence = this.calculateConfidence(deploymentDocs, framework, services)

    const analysis: ProjectAnalysis = {
      projectPath: this.projectPath,
      projectName: basename(this.projectPath),
      deploymentDocs,
      framework,
      services,
      buildConfig,
      environmentVars,
      confidence,
    }

    return analysis
  }

  private calculateConfidence(
    deploymentDocs: ProjectAnalysis['deploymentDocs'],
    framework: ProjectAnalysis['framework'],
    services: ProjectAnalysis['services'],
  ): number {
    let score = 0

    // Framework detection (0-40 points)
    if (framework.framework !== 'unknown') {
      score += 40
    } else if (framework.runtime !== 'unknown') {
      score += 20
    }

    // Deployment docs (0-30 points)
    if (deploymentDocs.hasDockerfile || deploymentDocs.hasDockerCompose) {
      score += 20
    }

    if (deploymentDocs.hasTerraform) {
      score += 10
    }

    // Service detection (0-20 points)
    if (services.database) score += 10
    if (services.cache) score += 5
    if (services.storage) score += 5

    // CI/CD config (0-10 points)
    if (deploymentDocs.cicdConfig?.platform) {
      score += 10
    }

    return Math.min(score, 100)
  }
}

