import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import type {ServiceRequirements} from '../types/analysis.js'

export class ServiceDetector {
  constructor(private projectPath: string) {}

  async detect(): Promise<ServiceRequirements> {
    const services: ServiceRequirements = {
      additionalServices: [],
    }

    // Detect from various sources
    this.detectFromPackageJson(services)
    this.detectFromRequirementsTxt(services)
    this.detectFromGoMod(services)
    this.detectFromDockerCompose(services)
    this.detectFromEnvExample(services)

    return services
  }

  private detectFromPackageJson(services: ServiceRequirements): void {
    const packageJsonPath = join(this.projectPath, 'package.json')
    
    if (!existsSync(packageJsonPath)) return

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      const deps = {...packageJson.dependencies, ...packageJson.devDependencies}

      // PostgreSQL
      if (deps.pg || deps.postgres || deps['@prisma/client'] || deps.sequelize) {
        services.database = {
          type: 'postgresql',
          required: true,
          detectedFrom: 'package.json dependencies',
        }
      }

      // MySQL
      if (deps.mysql || deps.mysql2) {
        services.database = {
          type: 'mysql',
          required: true,
          detectedFrom: 'package.json dependencies',
        }
      }

      // MongoDB
      if (deps.mongodb || deps.mongoose) {
        services.database = {
          type: 'mongodb',
          required: true,
          detectedFrom: 'package.json dependencies',
        }
      }

      // Redis (cache or queue)
      if (deps.redis || deps.ioredis) {
        services.cache = {
          type: 'redis',
          required: true,
          detectedFrom: 'package.json dependencies',
        }
      }

      // AWS SDK (S3, DynamoDB, SQS)
      if (deps['aws-sdk'] || deps['@aws-sdk/client-s3']) {
        services.storage = {
          type: 's3',
          required: false,
          detectedFrom: 'package.json (AWS SDK)',
        }
      }

      // WebSockets
      if (deps['socket.io'] || deps.ws || deps['@socket.io/redis-adapter']) {
        services.websockets = {
          required: true,
          detectedFrom: 'package.json (WebSocket libraries)',
        }
      }

      // Message Queues
      if (deps.amqplib) {
        services.queue = {
          type: 'rabbitmq',
          required: true,
          detectedFrom: 'package.json (amqplib)',
        }
      }

      if (deps.bull || deps.bullmq) {
        services.queue = {
          type: 'redis',
          required: true,
          detectedFrom: 'package.json (Bull queue)',
        }
        if (!services.cache) {
          services.cache = {
            type: 'redis',
            required: true,
            detectedFrom: 'package.json (Bull requires Redis)',
          }
        }
      }
    } catch {
      // Ignore parsing errors
    }
  }

  private detectFromRequirementsTxt(services: ServiceRequirements): void {
    const requirementsPath = join(this.projectPath, 'requirements.txt')
    
    if (!existsSync(requirementsPath)) return

    try {
      const content = readFileSync(requirementsPath, 'utf-8').toLowerCase()

      // PostgreSQL
      if (content.includes('psycopg') || content.includes('asyncpg')) {
        services.database = {
          type: 'postgresql',
          required: true,
          detectedFrom: 'requirements.txt',
        }
      }

      // MySQL
      if (content.includes('mysqlclient') || content.includes('pymysql')) {
        services.database = {
          type: 'mysql',
          required: true,
          detectedFrom: 'requirements.txt',
        }
      }

      // MongoDB
      if (content.includes('pymongo') || content.includes('motor')) {
        services.database = {
          type: 'mongodb',
          required: true,
          detectedFrom: 'requirements.txt',
        }
      }

      // Redis
      if (content.includes('redis') || content.includes('aioredis')) {
        services.cache = {
          type: 'redis',
          required: true,
          detectedFrom: 'requirements.txt',
        }
      }

      // AWS
      if (content.includes('boto3') || content.includes('aioboto3')) {
        services.storage = {
          type: 's3',
          required: false,
          detectedFrom: 'requirements.txt (boto3)',
        }
      }

      // Celery (requires Redis/RabbitMQ)
      if (content.includes('celery')) {
        services.queue = {
          type: 'redis',
          required: true,
          detectedFrom: 'requirements.txt (Celery)',
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private detectFromGoMod(services: ServiceRequirements): void {
    const goModPath = join(this.projectPath, 'go.mod')
    
    if (!existsSync(goModPath)) return

    try {
      const content = readFileSync(goModPath, 'utf-8').toLowerCase()

      // PostgreSQL
      if (content.includes('lib/pq') || content.includes('pgx')) {
        services.database = {
          type: 'postgresql',
          required: true,
          detectedFrom: 'go.mod',
        }
      }

      // MySQL
      if (content.includes('go-sql-driver/mysql')) {
        services.database = {
          type: 'mysql',
          required: true,
          detectedFrom: 'go.mod',
        }
      }

      // MongoDB
      if (content.includes('mongo-driver')) {
        services.database = {
          type: 'mongodb',
          required: true,
          detectedFrom: 'go.mod',
        }
      }

      // Redis
      if (content.includes('go-redis')) {
        services.cache = {
          type: 'redis',
          required: true,
          detectedFrom: 'go.mod',
        }
      }

      // AWS SDK
      if (content.includes('aws/aws-sdk-go')) {
        services.storage = {
          type: 's3',
          required: false,
          detectedFrom: 'go.mod (AWS SDK)',
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private detectFromDockerCompose(services: ServiceRequirements): void {
    const composeFiles = ['docker-compose.yml', 'docker-compose.yaml']
    
    for (const file of composeFiles) {
      const composePath = join(this.projectPath, file)
      if (!existsSync(composePath)) continue

      try {
        const content = readFileSync(composePath, 'utf-8').toLowerCase()

        // PostgreSQL
        if (content.includes('image: postgres') || content.includes('image: postgresql')) {
          services.database = {
            type: 'postgresql',
            required: true,
            detectedFrom: 'docker-compose.yml',
          }
        }

        // MySQL
        if (content.includes('image: mysql') || content.includes('image: mariadb')) {
          services.database = {
            type: 'mysql',
            required: true,
            detectedFrom: 'docker-compose.yml',
          }
        }

        // MongoDB
        if (content.includes('image: mongo')) {
          services.database = {
            type: 'mongodb',
            required: true,
            detectedFrom: 'docker-compose.yml',
          }
        }

        // Redis
        if (content.includes('image: redis')) {
          services.cache = {
            type: 'redis',
            required: true,
            detectedFrom: 'docker-compose.yml',
          }
        }

        // RabbitMQ
        if (content.includes('image: rabbitmq')) {
          services.queue = {
            type: 'rabbitmq',
            required: true,
            detectedFrom: 'docker-compose.yml',
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }

  private detectFromEnvExample(services: ServiceRequirements): void {
    const envFiles = ['.env.example', '.env.sample', 'env.example']
    
    for (const file of envFiles) {
      const envPath = join(this.projectPath, file)
      if (!existsSync(envPath)) continue

      try {
        const content = readFileSync(envPath, 'utf-8').toLowerCase()

        // Database URLs
        if (content.includes('database_url') || content.includes('db_url')) {
          if (content.includes('postgres')) {
            services.database = {
              type: 'postgresql',
              required: true,
              detectedFrom: '.env.example',
            }
          } else if (content.includes('mysql')) {
            services.database = {
              type: 'mysql',
              required: true,
              detectedFrom: '.env.example',
            }
          } else if (content.includes('mongodb')) {
            services.database = {
              type: 'mongodb',
              required: true,
              detectedFrom: '.env.example',
            }
          }
        }

        // Redis
        if (content.includes('redis_url') || content.includes('redis_host')) {
          services.cache = {
            type: 'redis',
            required: true,
            detectedFrom: '.env.example',
          }
        }

        // AWS
        if (content.includes('aws_access_key') || content.includes('s3_bucket')) {
          services.storage = {
            type: 's3',
            required: false,
            detectedFrom: '.env.example',
          }
        }
      } catch {
        // Ignore errors
      }
    }
  }
}

