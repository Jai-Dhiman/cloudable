/**
 * Template Engine - Renders PDF reports from templates using pdfkit
 */
import PDFDocument from 'pdfkit'
import type {TemplateContext, SectionConfig, TemplateLoader} from './types.js'
import {TemplateLoader as LoaderClass} from './loader.js'
import {hexToRgb, inchesToPoints, safeText, getStatusIcon, capitalizeFirst} from './utils.js'

// PDFKit document type
type PDFDoc = InstanceType<typeof PDFDocument>

export class TemplateEngine {
  private styles: Map<string, any> = new Map()

  constructor(private loader: LoaderClass) {
    this.buildStyles()
  }

  private buildStyles(): void {
    const stylesConfig = this.loader.getStylesConfig()
    
    this.styles.set('default', {
      fontSize: stylesConfig.default_font_size || 10,
      lineGap: (stylesConfig.default_leading || 14) - (stylesConfig.default_font_size || 10),
    })

    const h1Color = hexToRgb(stylesConfig.h1_color || '#000000')
    this.styles.set('h1', {
      fontSize: stylesConfig.h1_font_size || 20,
      bold: true,
      align: 'center',
      color: h1Color,
    })

    const h2Color = hexToRgb(stylesConfig.h2_color || '#0d47a1')
    this.styles.set('h2', {
      fontSize: stylesConfig.h2_font_size || 14,
      bold: true,
      color: h2Color,
      underline: false,
    })

    this.styles.set('h3', {
      fontSize: stylesConfig.h3_font_size || 11,
      bold: true,
    })

    this.styles.set('small', {
      fontSize: 8,
    })

    this.styles.set('grey', {
      fontSize: 10,
      color: 'gray',
    })
  }

  async render(context: TemplateContext): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const layoutConfig = this.loader.getLayoutConfig()
        const doc = new PDFDocument({
          size: 'LETTER',
          margin: inchesToPoints(layoutConfig.top_margin),
          info: {
            Title: `Cloudable - ${context.data.project.name} Analysis Report`,
            Author: 'Cloudable',
            Subject: 'Project Analysis Report',
          },
        })

        // PDFKit uses margin for all sides - we'll adjust positioning manually
        const leftMargin = inchesToPoints(layoutConfig.left_margin)
        const topMargin = inchesToPoints(layoutConfig.top_margin)
        
        // Store margins for use in rendering
        ;(doc as any)._customLeftMargin = leftMargin
        ;(doc as any)._customRightMargin = inchesToPoints(layoutConfig.right_margin)
        ;(doc as any)._customTopMargin = topMargin
        ;(doc as any)._customBottomMargin = inchesToPoints(layoutConfig.bottom_margin)
        
        // Set initial position
        doc.x = leftMargin
        doc.y = topMargin

        const buffers: Buffer[] = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('end', () => resolve(Buffer.concat(buffers)))
        doc.on('error', reject)

        // Render sections in order
        this.renderSections(doc, context).then(() => {
          doc.end()
        }).catch(reject)

      } catch (error) {
        reject(error)
      }
    })
  }

  private async renderSections(doc: PDFDoc, context: TemplateContext): Promise<void> {
    const sectionsOrder = this.loader.getSectionsOrder()
    
    for (const sectionName of sectionsOrder) {
      const section = await this.loader.loadSection(sectionName)
      if (section) {
        await this.renderSection(doc, section, context)
      }
    }
  }

  private async renderSection(
    doc: PDFDoc,
    section: SectionConfig,
    context: TemplateContext
  ): Promise<void> {
    const sectionType = section.type || 'custom'
    
    // Handle page_break specially (it has underscores)
    let rendererName: string
    if (sectionType === 'page_break') {
      rendererName = '_renderPageBreak'
    } else {
      // Convert snake_case to camelCase for method names
      const camelCase = sectionType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      rendererName = `_render${camelCase.charAt(0).toUpperCase() + camelCase.slice(1)}`
    }

    if (this[rendererName as keyof this]) {
      await (this[rendererName as keyof this] as any).call(this, doc, section, context)
    } else {
      console.warn(`Unknown section type: ${sectionType}`)
    }
  }

  private async _renderHeader(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const text = section.text || 'Cloudable - Project Analysis Report'
    const style = section.style || 'right'
    
    doc.fontSize(this.styles.get('default')!.fontSize)
    if (style === 'right') {
      doc.text(text, {align: 'right'})
    } else if (style === 'center') {
      doc.text(text, {align: 'center'})
    } else {
      doc.text(text)
    }
    doc.moveDown(0.5)
  }

  private async _renderTitle(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const {project} = context.data
    
    doc.fontSize(this.styles.get('h1')!.fontSize)
    doc.font('Helvetica-Bold')
    const h1Style = this.styles.get('h1')!
    if (h1Style.color) {
      const color = h1Style.color as {r: number; g: number; b: number}
      doc.fillColor([color.r, color.g, color.b])
    }
    doc.text(project.name, {align: 'center'})
    doc.moveDown(0.3)

    doc.fontSize(12)
    doc.font('Helvetica')
    doc.fillColor('black')
    doc.text(`Project Path: ${project.path}`, {align: 'center'})
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, {align: 'center'})
    doc.moveDown(1)
  }

  private async _renderSummary(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const {project, framework} = context.data
    
    doc.fontSize(this.styles.get('h2')!.fontSize)
    doc.font('Helvetica-Bold')
    const h2Color = hexToRgb(this.loader.getStylesConfig().h2_color || '#0d47a1')
    doc.fillColor([h2Color.r, h2Color.g, h2Color.b])
    doc.text('Project Summary')
    doc.moveDown(0.5)

    doc.fontSize(this.styles.get('default')!.fontSize)
    doc.font('Helvetica')
    doc.fillColor('black')
    
    doc.text(`Project Name: ${project.name}`)
    doc.text(`Confidence Score: ${project.confidence}%`)
    doc.moveDown(0.3)
    
    doc.text(`Framework: ${framework.name}${framework.version ? ` ${framework.version}` : ''}`)
    doc.text(`Type: ${capitalizeFirst(framework.type)}`)
    doc.text(`Runtime: ${capitalizeFirst(framework.runtime)}`)
    if (framework.packageManager) {
      doc.text(`Package Manager: ${framework.packageManager}`)
    }
    doc.moveDown(1)
  }

  private async _renderFramework(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const {framework} = context.data
    
    doc.fontSize(this.styles.get('h2')!.fontSize)
    doc.font('Helvetica-Bold')
    const h2Color = hexToRgb(this.loader.getStylesConfig().h2_color || '#0d47a1')
    doc.fillColor([h2Color.r, h2Color.g, h2Color.b])
    doc.text('Framework Detection')
    doc.moveDown(0.5)

    doc.fontSize(this.styles.get('default')!.fontSize)
    doc.font('Helvetica')
    doc.fillColor('black')
    
    const frameworkData = [
      ['Framework', framework.framework === 'unknown' ? 'Unknown' : capitalizeFirst(framework.framework)],
      ['Name', framework.name],
      ['Version', framework.version || 'N/A'],
      ['Type', capitalizeFirst(framework.type)],
      ['Runtime', capitalizeFirst(framework.runtime)],
      ['Package Manager', framework.packageManager || 'N/A'],
    ]

    const tableTop = doc.y
    const cellHeight = 20
    const cellPadding = 5
    const firstColWidth = 150
    const secondColWidth = 300

    frameworkData.forEach((row, index) => {
      const y = tableTop + (index * cellHeight)
      
      // Background for even rows
      if (index % 2 === 0) {
        doc.rect(doc.x, y, firstColWidth + secondColWidth, cellHeight)
          .fillColor('#f5f5f5')
          .fill()
          .fillColor('black')
      }

      doc.text(row[0], doc.x + cellPadding, y + cellPadding, {
        width: firstColWidth - (cellPadding * 2),
        align: 'left',
      })
      
      doc.text(row[1], doc.x + firstColWidth + cellPadding, y + cellPadding, {
        width: secondColWidth - (cellPadding * 2),
        align: 'left',
      })
    })

    doc.moveDown(1.5)
  }

  private async _renderServices(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const {services} = context.data
    
    doc.fontSize(this.styles.get('h2')!.fontSize)
    doc.font('Helvetica-Bold')
    const h2Color = hexToRgb(this.loader.getStylesConfig().h2_color || '#0d47a1')
    doc.fillColor([h2Color.r, h2Color.g, h2Color.b])
    doc.text('Required Services')
    doc.moveDown(0.5)

    doc.fontSize(this.styles.get('default')!.fontSize)
    doc.font('Helvetica')
    doc.fillColor('black')
    
    if (services.database) {
      doc.text(`${getStatusIcon(true)} Database: ${capitalizeFirst(services.database.type)}`)
      doc.fontSize(9)
      doc.fillColor('gray')
      doc.text(`   Detected from: ${services.database.detectedFrom}`)
      doc.fontSize(this.styles.get('default')!.fontSize)
      doc.fillColor('black')
      doc.moveDown(0.3)
    }

    if (services.cache) {
      doc.text(`${getStatusIcon(true)} Cache: ${capitalizeFirst(services.cache.type)}`)
      doc.fontSize(9)
      doc.fillColor('gray')
      doc.text(`   Detected from: ${services.cache.detectedFrom}`)
      doc.fontSize(this.styles.get('default')!.fontSize)
      doc.fillColor('black')
      doc.moveDown(0.3)
    }

    if (services.storage) {
      doc.text(`${getStatusIcon(true)} Storage: ${capitalizeFirst(services.storage.type)}`)
      doc.fontSize(9)
      doc.fillColor('gray')
      doc.text(`   Detected from: ${services.storage.detectedFrom}`)
      doc.fontSize(this.styles.get('default')!.fontSize)
      doc.fillColor('black')
      doc.moveDown(0.3)
    }

    if (services.queue) {
      doc.text(`${getStatusIcon(true)} Queue: ${capitalizeFirst(services.queue.type)}`)
      doc.fontSize(9)
      doc.fillColor('gray')
      doc.text(`   Detected from: ${services.queue.detectedFrom}`)
      doc.fontSize(this.styles.get('default')!.fontSize)
      doc.fillColor('black')
      doc.moveDown(0.3)
    }

    if (services.websockets) {
      doc.text(`${getStatusIcon(services.websockets.required)} WebSockets: ${services.websockets.required ? 'Required' : 'Not Required'}`)
      doc.fontSize(9)
      doc.fillColor('gray')
      doc.text(`   Detected from: ${services.websockets.detectedFrom}`)
      doc.fontSize(this.styles.get('default')!.fontSize)
      doc.fillColor('black')
      doc.moveDown(0.3)
    }

    if (services.additionalServices && services.additionalServices.length > 0) {
      doc.moveDown(0.3)
      doc.text('Additional Services:')
      services.additionalServices.forEach(service => {
        doc.fontSize(9)
        doc.text(`   • ${service}`)
      })
    }

    doc.moveDown(1)
  }

  private async _renderBuildConfig(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const {buildConfig} = context.data
    
    doc.fontSize(this.styles.get('h2')!.fontSize)
    doc.font('Helvetica-Bold')
    const h2Color = hexToRgb(this.loader.getStylesConfig().h2_color || '#0d47a1')
    doc.fillColor([h2Color.r, h2Color.g, h2Color.b])
    doc.text('Build Configuration')
    doc.moveDown(0.5)

    doc.fontSize(this.styles.get('default')!.fontSize)
    doc.font('Helvetica')
    doc.fillColor('black')
    
    if (buildConfig.installCommand) {
      doc.text(`Install: ${buildConfig.installCommand}`)
    }
    if (buildConfig.buildCommand) {
      doc.text(`Build: ${buildConfig.buildCommand}`)
    }
    if (buildConfig.startCommand) {
      doc.text(`Start: ${buildConfig.startCommand}`)
    }
    if (buildConfig.port) {
      doc.text(`Port: ${buildConfig.port}`)
    }
    if (buildConfig.healthCheckPath) {
      doc.text(`Health Check: ${buildConfig.healthCheckPath}`)
    }
    doc.text(`Environment Type: ${capitalizeFirst(buildConfig.environmentType)}`)
    
    doc.moveDown(1)
  }

  private async _renderDeploymentDocs(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const {deploymentDocs} = context.data
    
    doc.fontSize(this.styles.get('h2')!.fontSize)
    doc.font('Helvetica-Bold')
    const h2Color = hexToRgb(this.loader.getStylesConfig().h2_color || '#0d47a1')
    doc.fillColor([h2Color.r, h2Color.g, h2Color.b])
    doc.text('Deployment Documentation')
    doc.moveDown(0.5)

    doc.fontSize(this.styles.get('default')!.fontSize)
    doc.font('Helvetica')
    doc.fillColor('black')
    
    doc.text(`${getStatusIcon(deploymentDocs.hasDockerfile)} Dockerfile`)
    doc.text(`${getStatusIcon(deploymentDocs.hasDockerCompose)} docker-compose.yml`)
    doc.text(`${getStatusIcon(deploymentDocs.hasTerraform)} Terraform`)
    doc.text(`${getStatusIcon(deploymentDocs.hasReadme)} README`)
    doc.text(`${getStatusIcon(deploymentDocs.hasDeploymentGuide)} Deployment Guide`)
    
    if (deploymentDocs.cicdPlatform) {
      doc.text(`${getStatusIcon(true)} CI/CD: ${capitalizeFirst(deploymentDocs.cicdPlatform)}`)
      if (deploymentDocs.cicdConfigPath) {
        doc.fontSize(9)
        doc.fillColor('gray')
        doc.text(`   Config: ${deploymentDocs.cicdConfigPath}`)
        doc.fontSize(this.styles.get('default')!.fontSize)
        doc.fillColor('black')
      }
    }

    if (deploymentDocs.dockerComposeServices && deploymentDocs.dockerComposeServices.length > 0) {
      doc.moveDown(0.3)
      doc.text('Docker Services:')
      deploymentDocs.dockerComposeServices.forEach(service => {
        doc.fontSize(9)
        doc.text(`   • ${service}`)
      })
      doc.fontSize(this.styles.get('default')!.fontSize)
    }

    if (deploymentDocs.terraformResources && deploymentDocs.terraformResources.length > 0) {
      doc.moveDown(0.3)
      doc.text('Terraform Resources:')
      deploymentDocs.terraformResources.forEach(resource => {
        doc.fontSize(9)
        doc.text(`   • ${resource}`)
      })
      doc.fontSize(this.styles.get('default')!.fontSize)
    }

    doc.moveDown(1)
  }

  private async _renderEnvironmentVars(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    const {environmentVars} = context.data
    
    if (environmentVars.length === 0) {
      return
    }

    doc.fontSize(this.styles.get('h2')!.fontSize)
    doc.font('Helvetica-Bold')
    const h2Color = hexToRgb(this.loader.getStylesConfig().h2_color || '#0d47a1')
    doc.fillColor([h2Color.r, h2Color.g, h2Color.b])
    doc.text('Environment Variables')
    doc.moveDown(0.5)

    doc.fontSize(this.styles.get('default')!.fontSize)
    doc.font('Helvetica')
    doc.fillColor('black')

    const tableTop = doc.y
    const cellHeight = 25
    const cellPadding = 5
    const colWidths = [150, 80, 250]

    // Header
    doc.font('Helvetica-Bold')
    doc.rect(doc.x, tableTop, colWidths[0] + colWidths[1] + colWidths[2], cellHeight)
      .fillColor('#263238')
      .fill()
      .fillColor('white')
    doc.text('Variable', doc.x + cellPadding, tableTop + cellPadding, {width: colWidths[0] - (cellPadding * 2)})
    doc.text('Required', doc.x + colWidths[0] + cellPadding, tableTop + cellPadding, {width: colWidths[1] - (cellPadding * 2)})
    doc.text('Example / Description', doc.x + colWidths[0] + colWidths[1] + cellPadding, tableTop + cellPadding, {width: colWidths[2] - (cellPadding * 2)})
    
    doc.font('Helvetica')
    doc.fillColor('black')

    // Rows
    environmentVars.forEach((envVar, index) => {
      const y = tableTop + ((index + 1) * cellHeight)
      
      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(doc.x, y, colWidths[0] + colWidths[1] + colWidths[2], cellHeight)
          .fillColor('#f5f5f5')
          .fill()
          .fillColor('black')
      }

      doc.text(envVar.key, doc.x + cellPadding, y + cellPadding, {
        width: colWidths[0] - (cellPadding * 2),
      })
      
      doc.text(envVar.required ? 'Yes' : 'No', doc.x + colWidths[0] + cellPadding, y + cellPadding, {
        width: colWidths[1] - (cellPadding * 2),
      })
      
      const exampleText = envVar.example || envVar.description || 'N/A'
      doc.text(exampleText, doc.x + colWidths[0] + colWidths[1] + cellPadding, y + cellPadding, {
        width: colWidths[2] - (cellPadding * 2),
      })
    })

    doc.moveDown(1.5)
  }

  private async _renderRecommendations(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    if (!context.data.recommendations || context.data.recommendations.length === 0) {
      return
    }

    doc.fontSize(this.styles.get('h2')!.fontSize)
    doc.font('Helvetica-Bold')
    const h2Color = hexToRgb(this.loader.getStylesConfig().h2_color || '#0d47a1')
    doc.fillColor([h2Color.r, h2Color.g, h2Color.b])
    doc.text('Deployment Recommendations')
    doc.moveDown(0.5)

    doc.fontSize(this.styles.get('default')!.fontSize)
    doc.font('Helvetica')
    doc.fillColor('black')

    context.data.recommendations.forEach((rec, index) => {
      doc.text(`${index + 1}. ${rec}`)
      doc.moveDown(0.3)
    })

    doc.moveDown(1)
  }

  private async _renderPageBreak(doc: PDFDoc, section: SectionConfig, context: TemplateContext): Promise<void> {
    doc.addPage()
    // Reset position with custom margins after page break
    const leftMargin = (doc as any)._customLeftMargin || inchesToPoints(0.75)
    const topMargin = (doc as any)._customTopMargin || inchesToPoints(0.75)
    doc.x = leftMargin
    doc.y = topMargin
  }
}

