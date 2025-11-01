import type { ProjectFile } from '../../types/ai.types.js';

/**
 * Generate prompt for AI to create Docker configurations
 */
export function createDockerfileGenerationPrompt(files: ProjectFile[], preflightAnalysis?: any): string {
  // Build file content blocks
  const fileBlocks = files.map(file => {
    // Truncate very large files
    const content = file.content.length > 5000
      ? file.content.substring(0, 5000) + '\n\n[... file truncated for length ...]'
      : file.content;

    return `<file path="${file.path}">
${content}
</file>`;
  }).join('\n\n');

  // Build pre-flight context if available
  const preflightContext = preflightAnalysis ? `
## Pre-Flight Analysis (IMPORTANT - Use This Information):

**Package Manager Detected:** ${preflightAnalysis.packageManager}
- Use "${preflightAnalysis.packageManager}" commands in Dockerfile (e.g., "${preflightAnalysis.packageManager} ci" or "${preflightAnalysis.packageManager} install")

**Framework:** ${preflightAnalysis.framework}

**Fixes Already Applied:**
${preflightAnalysis.fixesApplied.map((fix: string) => `- ${fix}`).join('\n') || '- None'}

**Docker Context:**
${JSON.stringify(preflightAnalysis.dockerContext, null, 2)}

**CRITICAL:** You MUST use "${preflightAnalysis.packageManager}" as the package manager. Do NOT use yarn, npm, or other package managers if ${preflightAnalysis.packageManager} is specified.
` : '';

  return `You are an expert DevOps engineer. Generate production-ready Docker configurations for this project.
${preflightContext}

## Project Files:

${fileBlocks}

## Your Task:

Generate the following configurations:

1. **Dockerfile** - Production-ready, optimized container image
2. **.dockerignore** - Exclude unnecessary files from Docker context
3. **docker-compose.yml** (optional) - If the app needs multiple services (database, redis, etc.)

## Requirements:

**Dockerfile:**
- Use multi-stage builds to separate dependencies, build, and runtime stages
- Use Alpine-based images for smaller size (e.g., node:19-alpine)
- CRITICAL BUILD DEPENDENCIES: Install ALL dependencies (including devDependencies) in the build stage using "${preflightAnalysis?.packageManager || 'npm'} ci"
- NEVER use --only=production or --production flags during build stage (breaks Next.js builds)
- Properly handle build steps (npm run build, tsc, webpack, etc.)
- Use the package manager detected in pre-flight: ${preflightAnalysis?.packageManager || 'npm'}
- Set appropriate WORKDIR, EXPOSE, and CMD
- Optimize layer caching by copying package files first
- Handle framework-specific requirements:
  
  **Next.js with standalone output (CRITICAL - FOLLOW THIS EXACT STRUCTURE):**
  
  Stage 1 - Dependencies Stage:
    FROM node:19-alpine AS deps
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN ${preflightAnalysis?.packageManager || 'npm'} ci
  
  Stage 2 - Builder Stage:
    FROM node:19-alpine AS builder
    WORKDIR /app
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    RUN ${preflightAnalysis?.packageManager || 'npm'} run build
  
  Stage 3 - Runner Stage (EXACT STRUCTURE REQUIRED):
    FROM node:19-alpine AS runner
    WORKDIR /app
    
    ENV NODE_ENV production
    ENV PORT 3000
    ENV HOSTNAME "0.0.0.0"
    
    RUN addgroup --system --gid 1001 nodejs
    RUN adduser --system --uid 1001 nextjs
    
    COPY --from=builder /app/public ./public
    COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
    COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
    
    USER nextjs
    EXPOSE 3000
    CMD ["node", "server.js"]
  
  **CRITICAL NEXT.JS RULES - DO NOT DEVIATE:**
  - Line must be: COPY --from=builder /app/public ./public
  - Line must be: COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
  - Line must be: COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
  - The .next/static MUST be copied to ./.next/static (preserve directory structure)
  - DO NOT copy to ./static (wrong)
  - CMD must be: ["node", "server.js"] NOT "npm start"
  - MUST include all ENV variables, user setup, and security settings shown above
  
  - NestJS: Build with nest build, run dist/main.js
  - Python/Django: Collect static files, use gunicorn/uvicorn
  - Prisma: Run prisma generate before build

**.dockerignore:**
- Exclude: node_modules, .git, dist, build, .env files, test files, documentation
- Include patterns for common tools

**docker-compose.yml (if needed):**
- Only create if the app requires external services (database, redis, etc.)
- Include the app service + required services
- Proper networking and volume configurations
- Environment variable management

## Output Format:

You MUST use these exact XML tags:

<dockerfile>
[Your complete Dockerfile here]
</dockerfile>

<dockerignore>
[Your complete .dockerignore here]
</dockerignore>

<docker_compose>
[Your docker-compose.yml here - or write "NOT_NEEDED" if not required]
</docker_compose>

<explanation>
[Brief explanation of:
- Detected language/framework
- Key decisions made (package manager, base image, build process)
- Any special considerations
- Estimated image size
]
</explanation>

Generate the configurations now:`;
}

