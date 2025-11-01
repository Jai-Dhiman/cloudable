/**
 * Template Loader - Loads and validates template components
 */
import {readFile} from 'fs/promises'
import {join} from 'path'
import type {TemplateConfig, SectionConfig} from './types.js'

export class TemplateLoader {
  private config!: TemplateConfig

  constructor(private templatePath: string) {}

  async loadConfig(): Promise<void> {
    const configPath = join(this.templatePath, 'template.json')
    
    try {
      const configContent = await readFile(configPath, 'utf-8')
      this.config = JSON.parse(configContent)
    } catch (error) {
      throw new Error(`Failed to load template config from ${configPath}: ${error}`)
    }
  }

  async loadSection(sectionName: string): Promise<SectionConfig | null> {
    const sectionsDir = join(this.templatePath, 'sections')
    const sectionPath = join(sectionsDir, `${sectionName}.json`)
    
    try {
      const sectionContent = await readFile(sectionPath, 'utf-8')
      return JSON.parse(sectionContent)
    } catch (error) {
      console.warn(`Failed to load section ${sectionName}: ${error}`)
      return null
    }
  }

  getLayoutConfig() {
    return this.config.layout || {
      right_margin: 0.75,
      left_margin: 0.75,
      top_margin: 0.75,
      bottom_margin: 1.0,
    }
  }

  getStylesConfig() {
    return this.config.styles || {
      default_font_size: 10,
      default_leading: 14,
      h1_font_size: 20,
      h1_color: '#000000',
      h2_font_size: 14,
      h2_color: '#0d47a1',
      h3_font_size: 11,
    }
  }

  getSectionsOrder(): string[] {
    return this.config.sections || []
  }

  getMetadata() {
    return {
      id: this.config.id,
      name: this.config.name,
      version: this.config.version || '1.0.0',
      description: this.config.description || '',
    }
  }
}

