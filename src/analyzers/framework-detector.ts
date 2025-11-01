import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import type {FrameworkDetection} from '../types/analysis.js'

export class FrameworkDetector {
  constructor(private projectPath: string) {}

  async detect(): Promise<FrameworkDetection> {
    // Try different detection strategies
    const nodeDetection = this.detectNodeProject()
    if (nodeDetection.framework !== 'unknown') return nodeDetection

    const pythonDetection = this.detectPythonProject()
    if (pythonDetection.framework !== 'unknown') return pythonDetection

    const goDetection = this.detectGoProject()
    if (goDetection.framework !== 'unknown') return goDetection

    const phpDetection = this.detectPHPProject()
    if (phpDetection.framework !== 'unknown') return phpDetection

    const rubyDetection = this.detectRubyProject()
    if (rubyDetection.framework !== 'unknown') return rubyDetection

    const rustDetection = this.detectRustProject()
    if (rustDetection.framework !== 'unknown') return rustDetection

    const javaDetection = this.detectJavaProject()
    if (javaDetection.framework !== 'unknown') return javaDetection

    // Unknown project
    return {
      name: 'Unknown',
      type: 'unknown',
      runtime: 'unknown',
      framework: 'unknown',
    }
  }

  private detectNodeProject(): FrameworkDetection {
    const packageJsonPath = join(this.projectPath, 'package.json')
    
    if (!existsSync(packageJsonPath)) {
      return this.unknownFramework()
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const deps = {...packageJson.dependencies, ...packageJson.devDependencies}

      // Detect package manager
      let packageManager: FrameworkDetection['packageManager'] = 'npm'
      if (existsSync(join(this.projectPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm'
      else if (existsSync(join(this.projectPath, 'yarn.lock'))) packageManager = 'yarn'
      else if (existsSync(join(this.projectPath, 'bun.lockb'))) packageManager = 'bun'

      // Next.js
      if (deps.next) {
        return {
          name: 'Next.js',
          version: deps.next,
          type: 'fullstack',
          runtime: 'node',
          framework: 'nextjs',
          packageManager,
        }
      }

      // Remix
      if (deps['@remix-run/react'] || deps['@remix-run/node']) {
        return {
          name: 'Remix',
          version: deps['@remix-run/react'] || deps['@remix-run/node'],
          type: 'fullstack',
          runtime: 'node',
          framework: 'remix',
          packageManager,
        }
      }

      // React (SPA)
      if (deps.react && !deps.next && !deps['@remix-run/react']) {
        return {
          name: 'React',
          version: deps.react,
          type: 'web',
          runtime: 'node',
          framework: 'react',
          packageManager,
        }
      }

      // Vue
      if (deps.vue) {
        return {
          name: 'Vue',
          version: deps.vue,
          type: 'web',
          runtime: 'node',
          framework: 'vue',
          packageManager,
        }
      }

      // Angular
      if (deps['@angular/core']) {
        return {
          name: 'Angular',
          version: deps['@angular/core'],
          type: 'web',
          runtime: 'node',
          framework: 'angular',
          packageManager,
        }
      }

      // Svelte
      if (deps.svelte) {
        return {
          name: 'Svelte',
          version: deps.svelte,
          type: 'web',
          runtime: 'node',
          framework: 'svelte',
          packageManager,
        }
      }

      // NestJS
      if (deps['@nestjs/core']) {
        return {
          name: 'NestJS',
          version: deps['@nestjs/core'],
          type: 'api',
          runtime: 'node',
          framework: 'nestjs',
          packageManager,
        }
      }

      // Express
      if (deps.express) {
        return {
          name: 'Express',
          version: deps.express,
          type: 'api',
          runtime: 'node',
          framework: 'express',
          packageManager,
        }
      }

      // Fastify
      if (deps.fastify) {
        return {
          name: 'Fastify',
          version: deps.fastify,
          type: 'api',
          runtime: 'node',
          framework: 'fastify',
          packageManager,
        }
      }

      // Generic Node.js project
      return {
        name: 'Node.js',
        version: packageJson.engines?.node,
        type: 'unknown',
        runtime: 'node',
        framework: 'unknown',
        packageManager,
      }
    } catch {
      return this.unknownFramework()
    }
  }

  private detectPythonProject(): FrameworkDetection {
    const requirementsPath = join(this.projectPath, 'requirements.txt')
    const poetryPath = join(this.projectPath, 'pyproject.toml')
    
    let deps: string[] = []
    let packageManager: FrameworkDetection['packageManager'] = 'pip'

    // Parse requirements.txt
    if (existsSync(requirementsPath)) {
      try {
        const content = readFileSync(requirementsPath, 'utf-8')
        deps = content.split('\n').map(line => line.trim().toLowerCase())
      } catch {
        // Ignore
      }
    }

    // Parse pyproject.toml (Poetry)
    if (existsSync(poetryPath)) {
      packageManager = 'poetry'
      try {
        const content = readFileSync(poetryPath, 'utf-8')
        deps = content.split('\n').map(line => line.trim().toLowerCase())
      } catch {
        // Ignore
      }
    }

    if (deps.length === 0) return this.unknownFramework()

    // Django
    if (deps.some(dep => dep.startsWith('django'))) {
      return {
        name: 'Django',
        type: 'fullstack',
        runtime: 'python',
        framework: 'django',
        packageManager,
      }
    }

    // FastAPI
    if (deps.some(dep => dep.startsWith('fastapi'))) {
      return {
        name: 'FastAPI',
        type: 'api',
        runtime: 'python',
        framework: 'fastapi',
        packageManager,
      }
    }

    // Flask
    if (deps.some(dep => dep.startsWith('flask'))) {
      return {
        name: 'Flask',
        type: 'api',
        runtime: 'python',
        framework: 'flask',
        packageManager,
      }
    }

    // Generic Python project
    return {
      name: 'Python',
      type: 'unknown',
      runtime: 'python',
      framework: 'unknown',
      packageManager,
    }
  }

  private detectGoProject(): FrameworkDetection {
    const goModPath = join(this.projectPath, 'go.mod')
    
    if (!existsSync(goModPath)) {
      return this.unknownFramework()
    }

    try {
      const content = readFileSync(goModPath, 'utf-8').toLowerCase()

      // Gin
      if (content.includes('gin-gonic/gin')) {
        return {
          name: 'Gin',
          type: 'api',
          runtime: 'go',
          framework: 'gin',
          packageManager: 'go',
        }
      }

      // Fiber
      if (content.includes('gofiber/fiber')) {
        return {
          name: 'Fiber',
          type: 'api',
          runtime: 'go',
          framework: 'fiber',
          packageManager: 'go',
        }
      }

      // Generic Go project
      return {
        name: 'Go',
        type: 'api',
        runtime: 'go',
        framework: 'unknown',
        packageManager: 'go',
      }
    } catch {
      return this.unknownFramework()
    }
  }

  private detectPHPProject(): FrameworkDetection {
    const composerPath = join(this.projectPath, 'composer.json')
    
    if (!existsSync(composerPath)) {
      return this.unknownFramework()
    }

    try {
      const composer = JSON.parse(readFileSync(composerPath, 'utf-8'))
      const deps = {...composer.require, ...composer['require-dev']}

      // Laravel
      if (deps['laravel/framework']) {
        return {
          name: 'Laravel',
          version: deps['laravel/framework'],
          type: 'fullstack',
          runtime: 'php',
          framework: 'laravel',
        }
      }

      // Generic PHP
      return {
        name: 'PHP',
        type: 'unknown',
        runtime: 'php',
        framework: 'unknown',
      }
    } catch {
      return this.unknownFramework()
    }
  }

  private detectRubyProject(): FrameworkDetection {
    const gemfilePath = join(this.projectPath, 'Gemfile')
    
    if (!existsSync(gemfilePath)) {
      return this.unknownFramework()
    }

    try {
      const content = readFileSync(gemfilePath, 'utf-8').toLowerCase()

      // Rails
      if (content.includes('rails')) {
        return {
          name: 'Ruby on Rails',
          type: 'fullstack',
          runtime: 'ruby',
          framework: 'rails',
        }
      }

      // Generic Ruby
      return {
        name: 'Ruby',
        type: 'unknown',
        runtime: 'ruby',
        framework: 'unknown',
      }
    } catch {
      return this.unknownFramework()
    }
  }

  private detectRustProject(): FrameworkDetection {
    const cargoPath = join(this.projectPath, 'Cargo.toml')
    
    if (!existsSync(cargoPath)) {
      return this.unknownFramework()
    }

    return {
      name: 'Rust',
      type: 'unknown',
      runtime: 'rust',
      framework: 'unknown',
      packageManager: 'cargo',
    }
  }

  private detectJavaProject(): FrameworkDetection {
    const pomPath = join(this.projectPath, 'pom.xml')
    const gradlePath = join(this.projectPath, 'build.gradle')
    
    if (!existsSync(pomPath) && !existsSync(gradlePath)) {
      return this.unknownFramework()
    }

    return {
      name: 'Java',
      type: 'unknown',
      runtime: 'java',
      framework: 'unknown',
    }
  }

  private unknownFramework(): FrameworkDetection {
    return {
      name: 'Unknown',
      type: 'unknown',
      runtime: 'unknown',
      framework: 'unknown',
    }
  }
}

