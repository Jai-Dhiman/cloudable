/**
 * TypeScript interfaces for PDF generator template system
 */
import type {ProjectAnalysis} from '../src/types/analysis.js'

export interface TemplateConfig {
  id: string
  name: string
  version: string
  description: string
  layout: LayoutConfig
  styles: StylesConfig
  sections: string[]
  path?: string
}

export interface LayoutConfig {
  right_margin: number // in inches
  left_margin: number
  top_margin: number
  bottom_margin: number
}

export interface StylesConfig {
  default_font_size: number
  default_leading?: number
  h1_font_size: number
  h1_color: string
  h2_font_size: number
  h2_color: string
  h3_font_size?: number
  h3_color?: string
}

export interface SectionConfig {
  type: string
  [key: string]: any
}

export interface TemplateLoader {
  loadConfig(): Promise<void>
  loadSection(sectionName: string): Promise<SectionConfig | null>
  getLayoutConfig(): LayoutConfig
  getStylesConfig(): StylesConfig
  getSectionsOrder(): string[]
  getMetadata(): {id: string; name: string; version: string; description: string}
}

export interface TemplateContext {
  analysis: ProjectAnalysis
  data: {
    project: {
      name: string
      path: string
      confidence: number
    }
    framework: {
      name: string
      version?: string
      type: string
      runtime: string
      framework: string
      packageManager?: string
    }
    services: {
      database?: {
        type: string
        required: boolean
        detectedFrom: string
      }
      cache?: {
        type: string
        required: boolean
        detectedFrom: string
      }
      storage?: {
        type: string
        required: boolean
        detectedFrom: string
      }
      queue?: {
        type: string
        required: boolean
        detectedFrom: string
      }
      websockets?: {
        required: boolean
        detectedFrom: string
      }
      additionalServices: string[]
    }
    buildConfig: {
      installCommand?: string
      buildCommand?: string
      startCommand?: string
      port?: number
      healthCheckPath?: string
      environmentType: string
    }
    deploymentDocs: {
      hasDockerfile: boolean
      hasDockerCompose: boolean
      hasTerraform: boolean
      hasReadme: boolean
      hasDeploymentGuide: boolean
      cicdPlatform?: string
      cicdConfigPath?: string
      dockerComposeServices?: string[]
      terraformResources?: string[]
    }
    environmentVars: Array<{
      key: string
      required: boolean
      example?: string
      description?: string
    }>
    recommendations?: string[]
  }
}

