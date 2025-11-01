/**
 * Template Registry - Manages available PDF report templates
 */
import {readdir, stat} from 'fs/promises'
import {join} from 'path'
import {readFile} from 'fs/promises'
import type {TemplateConfig} from './types.js'

export class TemplateRegistry {
  private templates: Map<string, TemplateConfig> = new Map()

  constructor(private templatesDir: string) {}

  async loadTemplates(): Promise<void> {
    try {
      const entries = await readdir(this.templatesDir)
      
      for (const entry of entries) {
        const entryPath = join(this.templatesDir, entry)
        const stats = await stat(entryPath)
        
        if (stats.isDirectory() && !entry.startsWith('_')) {
          const configPath = join(entryPath, 'template.json')
          
          try {
            const configContent = await readFile(configPath, 'utf-8')
            const config: TemplateConfig = JSON.parse(configContent)
            config.path = entryPath
            config.id = config.id || entry
            
            this.templates.set(config.id, config)
            console.log(`Loaded template: ${config.id}`)
          } catch (error) {
            console.warn(`Failed to load template from ${configPath}: ${error}`)
          }
        }
      }
    } catch (error) {
      console.warn(`Templates directory does not exist or cannot be read: ${this.templatesDir}`)
    }
  }

  getTemplate(templateId: string): TemplateConfig | undefined {
    return this.templates.get(templateId)
  }

  listTemplates(): Array<{id: string; name: string; description: string; version: string}> {
    return Array.from(this.templates.values()).map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      version: template.version,
    }))
  }

  templateExists(templateId: string): boolean {
    return this.templates.has(templateId)
  }
}

