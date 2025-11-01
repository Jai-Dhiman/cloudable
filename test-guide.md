# Testing Cloudable Analyzer on Any Repository

## Basic Usage

```bash
# Test on current directory
cloudable analyze

# Test on any path
cloudable analyze /path/to/repo

# Test with verbose output (shows all env vars)
cloudable analyze /path/to/repo -v
```

## What It Can Detect

### Frameworks (Node.js)
- Next.js, Remix, React, Vue, Angular, Svelte
- Express, Fastify, NestJS

### Frameworks (Python)
- Django, FastAPI, Flask

### Frameworks (Go)
- Gin, Fiber

### Frameworks (Others)
- Laravel (PHP)
- Rails (Ruby)
- Rust, Java (basic)

### Services
- Databases: PostgreSQL, MySQL, MongoDB, SQLite, Redis
- Cache: Redis, Memcached
- Storage: S3, GCS, Azure Blob
- Queues: RabbitMQ, SQS, Redis, Kafka
- WebSockets

### Deployment Docs
- Dockerfile
- docker-compose.yml
- Terraform files
- CI/CD configs (GitHub Actions, GitLab CI, etc.)

## Testing on Real Projects

```bash
# Clone a Next.js project
git clone https://github.com/vercel/next.js /tmp/nextjs-example
cd /path/to/cloudable
cloudable analyze /tmp/nextjs-example/examples/blog-starter

# Test on a Django project
git clone https://github.com/django/django /tmp/django
cloudable analyze /tmp/django

# Test on your own projects
cloudable analyze ~/projects/my-app
```
