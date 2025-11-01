import { readFile, readdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { existsSync } from 'node:fs'

export interface FileContent {
  path: string
  content: string
}

export interface ProjectFiles {
  packageJson?: string
  requirementsTxt?: string
  gemfile?: string
  goMod?: string
  cargoToml?: string
  readme?: string
  dockerfile?: string
  dockerCompose?: string
  terraform?: string[]
  otherDocs?: FileContent[]
}

export class AIProjectAnalyzer {
  constructor(private projectPath: string) {}

  async gatherProjectFiles(): Promise<ProjectFiles> {
    const files: ProjectFiles = {
      terraform: [],
      otherDocs: [],
    }

    // Read package.json
    if (existsSync(join(this.projectPath, 'package.json'))) {
      files.packageJson = await this.readFileSafe('package.json')
    }

    // Read Python requirements
    if (existsSync(join(this.projectPath, 'requirements.txt'))) {
      files.requirementsTxt = await this.readFileSafe('requirements.txt')
    }

    // Read Ruby Gemfile
    if (existsSync(join(this.projectPath, 'Gemfile'))) {
      files.gemfile = await this.readFileSafe('Gemfile')
    }

    // Read Go mod
    if (existsSync(join(this.projectPath, 'go.mod'))) {
      files.goMod = await this.readFileSafe('go.mod')
    }

    // Read Rust Cargo
    if (existsSync(join(this.projectPath, 'Cargo.toml'))) {
      files.cargoToml = await this.readFileSafe('Cargo.toml')
    }

    // Read README files
    const readmeVariants = ['README.md', 'readme.md', 'README.MD', 'README', 'readme.txt']
    for (const variant of readmeVariants) {
      if (existsSync(join(this.projectPath, variant))) {
        files.readme = await this.readFileSafe(variant)
        break
      }
    }

    // Read Dockerfile
    if (existsSync(join(this.projectPath, 'Dockerfile'))) {
      files.dockerfile = await this.readFileSafe('Dockerfile')
    }

    // Read docker-compose
    const composeVariants = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']
    for (const variant of composeVariants) {
      if (existsSync(join(this.projectPath, variant))) {
        files.dockerCompose = await this.readFileSafe(variant)
        break
      }
    }

    // Read Terraform files
    try {
      const allFiles = await readdir(this.projectPath)
      for (const file of allFiles) {
        if (file.endsWith('.tf')) {
          const content = await this.readFileSafe(file)
          if (content) {
            files.terraform?.push(content)
          }
        }
      }
    } catch (error) {
      // Directory reading failed, skip
    }

    // Read other documentation files
    const docFiles = [
      'DEPLOY.md',
      'DEPLOYMENT.md',
      'ARCHITECTURE.md',
      'SETUP.md',
      'INSTALL.md',
      'CONTRIBUTING.md',
    ]

    for (const docFile of docFiles) {
      if (existsSync(join(this.projectPath, docFile))) {
        const content = await this.readFileSafe(docFile)
        if (content) {
          files.otherDocs?.push({ path: docFile, content })
        }
      }
    }

    return files
  }

  private async readFileSafe(fileName: string): Promise<string | undefined> {
    try {
      const content = await readFile(join(this.projectPath, fileName), 'utf-8')
      // Limit file size to 50KB to avoid token limits
      return content.slice(0, 50000)
    } catch (error) {
      return undefined
    }
  }

  formatFilesForAI(files: ProjectFiles): string {
    let formatted = '=== PROJECT FILES ===\n\n'

    if (files.packageJson) {
      formatted += '--- package.json ---\n' + files.packageJson + '\n\n'
    }

    if (files.requirementsTxt) {
      formatted += '--- requirements.txt ---\n' + files.requirementsTxt + '\n\n'
    }

    if (files.gemfile) {
      formatted += '--- Gemfile ---\n' + files.gemfile + '\n\n'
    }

    if (files.goMod) {
      formatted += '--- go.mod ---\n' + files.goMod + '\n\n'
    }

    if (files.cargoToml) {
      formatted += '--- Cargo.toml ---\n' + files.cargoToml + '\n\n'
    }

    if (files.readme) {
      formatted += '--- README ---\n' + files.readme + '\n\n'
    }

    if (files.dockerfile) {
      formatted += '--- Dockerfile ---\n' + files.dockerfile + '\n\n'
    }

    if (files.dockerCompose) {
      formatted += '--- docker-compose.yml ---\n' + files.dockerCompose + '\n\n'
    }

    if (files.terraform && files.terraform.length > 0) {
      formatted += '--- Terraform files ---\n' + files.terraform.join('\n---\n') + '\n\n'
    }

    if (files.otherDocs && files.otherDocs.length > 0) {
      for (const doc of files.otherDocs) {
        formatted += `--- ${doc.path} ---\n${doc.content}\n\n`
      }
    }

    return formatted
  }
}

