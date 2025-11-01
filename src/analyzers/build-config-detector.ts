import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import type {BuildConfig, EnvironmentVar} from '../types/analysis.js'

export class BuildConfigDetector {
  constructor(private projectPath: string) {}

  async detectBuildConfig(): Promise<BuildConfig> {
    const config: BuildConfig = {
      environmentType: 'production',
    }

    // Try Node.js detection
    const nodeConfig = this.detectNodeConfig()
    if (nodeConfig.buildCommand) {
      return {...config, ...nodeConfig}
    }

    // Try Python detection
    const pythonConfig = this.detectPythonConfig()
    if (pythonConfig.startCommand) {
      return {...config, ...pythonConfig}
    }

    // Try Go detection
    const goConfig = this.detectGoConfig()
    if (goConfig.startCommand) {
      return {...config, ...goConfig}
    }

    // Try Dockerfile detection
    const dockerConfig = this.detectFromDockerfile()
    if (dockerConfig.startCommand) {
      return {...config, ...dockerConfig}
    }

    return config
  }

  async detectEnvironmentVars(): Promise<EnvironmentVar[]> {
    const envVars: EnvironmentVar[] = []
    const envFiles = ['.env.example', '.env.sample', 'env.example', '.env.template']

    for (const file of envFiles) {
      const envPath = join(this.projectPath, file)
      if (!existsSync(envPath)) continue

      try {
        const content = readFileSync(envPath, 'utf-8')
        const lines = content.split('\n')

        for (const line of lines) {
          const trimmed = line.trim()
          
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) continue

          // Parse KEY=value or KEY=
          const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
          if (match) {
            const [, key, value] = match
            envVars.push({
              key,
              required: true,
              example: value || undefined,
              description: undefined,
            })
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return envVars
  }

  private detectNodeConfig(): Partial<BuildConfig> {
    const packageJsonPath = join(this.projectPath, 'package.json')
    
    if (!existsSync(packageJsonPath)) {
      return {}
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const scripts = packageJson.scripts || {}

      return {
        buildCommand: scripts.build || scripts.compile || undefined,
        startCommand: scripts.start || scripts.serve || undefined,
        installCommand: this.detectPackageManager(),
        port: this.detectPortFromPackageJson(packageJson),
        healthCheckPath: '/',
      }
    } catch {
      return {}
    }
  }

  private detectPythonConfig(): Partial<BuildConfig> {
    const requirementsPath = join(this.projectPath, 'requirements.txt')
    const managePyPath = join(this.projectPath, 'manage.py')
    
    if (!existsSync(requirementsPath)) {
      return {}
    }

    try {
      const content = readFileSync(requirementsPath, 'utf-8').toLowerCase()

      let startCommand: string | undefined
      let port = 8000

      // Django
      if (existsSync(managePyPath)) {
        startCommand = 'python manage.py runserver 0.0.0.0:8000'
        port = 8000
      }
      // FastAPI
      else if (content.includes('fastapi')) {
        startCommand = 'uvicorn main:app --host 0.0.0.0 --port 8000'
        port = 8000
      }
      // Flask
      else if (content.includes('flask')) {
        startCommand = 'flask run --host=0.0.0.0 --port=5000'
        port = 5000
      }

      return {
        installCommand: 'pip install -r requirements.txt',
        startCommand,
        port,
        healthCheckPath: '/health',
      }
    } catch {
      return {}
    }
  }

  private detectGoConfig(): Partial<BuildConfig> {
    const goModPath = join(this.projectPath, 'go.mod')
    
    if (!existsSync(goModPath)) {
      return {}
    }

    return {
      buildCommand: 'go build -o app .',
      startCommand: './app',
      installCommand: 'go mod download',
      port: 8080,
      healthCheckPath: '/health',
    }
  }

  private detectFromDockerfile(): Partial<BuildConfig> {
    const dockerfilePath = join(this.projectPath, 'Dockerfile')
    
    if (!existsSync(dockerfilePath)) {
      return {}
    }

    try {
      const content = readFileSync(dockerfilePath, 'utf-8')
      const lines = content.split('\n')

      let port: number | undefined
      let startCommand: string | undefined

      for (const line of lines) {
        const trimmed = line.trim()

        // Detect EXPOSE directive
        if (trimmed.startsWith('EXPOSE')) {
          const match = trimmed.match(/EXPOSE\s+(\d+)/)
          if (match) {
            port = Number.parseInt(match[1], 10)
          }
        }

        // Detect CMD directive
        if (trimmed.startsWith('CMD')) {
          startCommand = trimmed.replace(/^CMD\s+/, '')
          // Remove brackets if JSON format
          startCommand = startCommand.replace(/^\[|\]$/g, '')
        }
      }

      return {
        port,
        startCommand,
        healthCheckPath: '/',
      }
    } catch {
      return {}
    }
  }

  private detectPackageManager(): string {
    if (existsSync(join(this.projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm install'
    }

    if (existsSync(join(this.projectPath, 'yarn.lock'))) {
      return 'yarn install'
    }

    if (existsSync(join(this.projectPath, 'bun.lockb'))) {
      return 'bun install'
    }

    return 'npm install'
  }

  private detectPortFromPackageJson(packageJson: any): number | undefined {
    // Check for common port configurations
    const scripts = packageJson.scripts || {}
    
    // Look in start script
    if (scripts.start) {
      const portMatch = scripts.start.match(/--port[= ](\d+)/)
      if (portMatch) {
        return Number.parseInt(portMatch[1], 10)
      }
    }

    // Check for Next.js (default 3000)
    if (packageJson.dependencies?.next) {
      return 3000
    }

    // Check for React dev server (default 3000)
    if (packageJson.dependencies?.['react-scripts']) {
      return 3000
    }

    return undefined
  }
}

