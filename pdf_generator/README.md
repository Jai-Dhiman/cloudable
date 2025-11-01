# PDF Generator for Cloudable

A flexible, template-based PDF generation system for creating project analysis reports in the Cloudable CLI tool.

## Overview

This module generates professional PDF reports from `ProjectAnalysis` results. It uses a template-based architecture that allows you to customize report layouts and styles without modifying code.

## Quick Start

### Using the PDF Generator Service

```typescript
import {PDFGeneratorService} from './pdf_generator/service.js'
import {ProjectAnalyzer} from './src/analyzers/project-analyzer.js'

// Analyze a project
const analyzer = new ProjectAnalyzer('/path/to/project')
const analysis = await analyzer.analyze()

// Generate PDF
const pdfService = new PDFGeneratorService()
const pdfBuffer = await pdfService.generatePDF(analysis, 'default')

// Save to file
import {writeFile} from 'fs/promises'
await writeFile('report.pdf', pdfBuffer)
```

### Using from CLI

```bash
# Generate PDF with default template
cloudable analyze --pdf=default

# Use detailed template
cloudable analyze --pdf=detailed

# Use executive summary template
cloudable analyze --pdf=executive

# Specify output file
cloudable analyze --pdf=default --pdf-output=my-report.pdf
```

## Available Templates

### Default Template (`default`)
- Standard comprehensive report
- Includes all analysis sections
- Balanced layout and styling
- Best for: General use cases

### Detailed Template (`detailed`)
- Comprehensive analysis
- All sections with page breaks
- Smaller fonts for more content
- Best for: Deep-dive analysis

### Executive Template (`executive`)
- Condensed, executive-friendly format
- High-level insights only
- Larger margins and fonts
- Best for: Quick overviews and presentations

## Template Structure

Templates are defined in JSON and located in `pdf_generator/templates/`. Each template consists of:

1. **Template Configuration** (`template.json`):
   - Template metadata (id, name, version, description)
   - Layout settings (margins)
   - Style configuration (fonts, colors)
   - Ordered list of sections to render

2. **Section Definitions** (JSON files in `sections/` directory):
   - Define the content and rendering for each section
   - Support various section types: header, title, summary, framework, services, etc.

## Section Types

### Header
```json
{
  "type": "header",
  "text": "Cloudable - Project Analysis Report",
  "style": "right"
}
```

### Title
```json
{
  "type": "title"
}
```

### Summary
```json
{
  "type": "summary"
}
```

### Framework
```json
{
  "type": "framework"
}
```

### Services
```json
{
  "type": "services"
}
```

### Build Config
```json
{
  "type": "build_config"
}
```

### Deployment Docs
```json
{
  "type": "deployment_docs"
}
```

### Environment Variables
```json
{
  "type": "environment_vars"
}
```

### Recommendations
```json
{
  "type": "recommendations"
}
```

### Page Break
```json
{
  "type": "page_break"
}
```

## Context Data Structure

Templates have access to the following context data:

```typescript
{
  analysis: ProjectAnalysis,
  data: {
    project: {
      name: string
      path: string
      confidence: number
    },
    framework: {
      name: string
      version?: string
      type: string
      runtime: string
      framework: string
      packageManager?: string
    },
    services: {
      database?: {...}
      cache?: {...}
      storage?: {...}
      queue?: {...}
      websockets?: {...}
      additionalServices: string[]
    },
    buildConfig: {...},
    deploymentDocs: {...},
    environmentVars: [...],
    recommendations: string[]
  }
}
```

## Creating Custom Templates

1. Create a new directory in `pdf_generator/templates/`:
   ```bash
   mkdir -p pdf_generator/templates/my_template/sections
   ```

2. Create `template.json`:
   ```json
   {
     "id": "my_template",
     "name": "My Custom Template",
     "version": "1.0.0",
     "description": "Custom template description",
     "layout": {
       "right_margin": 0.75,
       "left_margin": 0.75,
       "top_margin": 0.75,
       "bottom_margin": 1.0
     },
     "styles": {
       "default_font_size": 10,
       "h1_font_size": 20,
       "h1_color": "#000000",
       "h2_font_size": 14,
       "h2_color": "#0d47a1"
     },
     "sections": [
       "header",
       "title",
       "summary"
     ]
   }
   ```

3. Create section JSON files in `sections/` directory

4. The template will be automatically discovered by the registry

## API Reference

### PDFGeneratorService

#### `listAvailableTemplates()`
Returns a list of all available templates with their metadata.

#### `generatePDF(analysis: ProjectAnalysis, templateId?: string): Promise<Buffer>`
Generates a PDF report from the provided analysis.
- `analysis`: The project analysis result
- `templateId`: Template to use (default: "default")
- Returns: PDF buffer

### TemplateEngine

Low-level PDF rendering engine. Used internally by `PDFGeneratorService`.

### TemplateRegistry

Manages template discovery and loading.

### TemplateLoader

Loads and validates template components from disk.

## Dependencies

- **pdfkit**: PDF generation library
- **@types/pdfkit**: TypeScript definitions

## Architecture

The PDF generator follows a modular architecture:

1. **Service Layer** (`service.ts`): High-level API for generating PDFs
2. **Engine** (`engine.ts`): PDF rendering using pdfkit
3. **Registry** (`registry.ts`): Template discovery and management
4. **Loader** (`loader.ts`): Template configuration loading
5. **Templates**: JSON-based template definitions

## License

Part of the Cloudable project.

