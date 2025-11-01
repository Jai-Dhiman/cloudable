import type { ProjectFile } from '../../types/ai.types.js';

/**
 * Generate prompt for AI to create Docker configurations
 */
export function createDockerfileGenerationPrompt(files: ProjectFile[]): string {
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

  return `You are an expert DevOps engineer. Generate production-ready Docker configurations for this project.

## Project Files:

${fileBlocks}

## Your Task:

Generate the following configurations:

1. **Dockerfile** - Production-ready, optimized container image
2. **.dockerignore** - Exclude unnecessary files from Docker context
3. **docker-compose.yml** (optional) - If the app needs multiple services (database, redis, etc.)

## Requirements:

**Dockerfile:**
- Use multi-stage builds for compiled languages (TypeScript, Go, etc.)
- Use Alpine-based images for smaller size
- Install ONLY production dependencies
- Properly handle build steps (tsc, webpack, npm run build, etc.)
- Detect and use the correct package manager (npm, yarn, pnpm, bun)
- Set appropriate WORKDIR, EXPOSE, and CMD
- Optimize layer caching
- Handle framework-specific requirements:
  - Next.js: Use standalone output, copy .next/standalone
  - NestJS: Build with nest build, run dist/main.js
  - Python/Django: Collect static files, use gunicorn/uvicorn
  - Prisma: Run prisma generate before build
- Set correct base image version from detected language version

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

