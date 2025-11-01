/**
 * Generate prompt for AI to decide which files to read
 */
export function createFileDiscoveryPrompt(directoryTree: string): string {
  return `You are analyzing a software project to generate Docker configurations.

Here is the complete directory structure:

<directory_structure>
${directoryTree}
</directory_structure>

**Your Task:**
Analyze this structure and identify which files you need to read to understand:
1. Programming language and framework
2. Dependencies and package management
3. Build process and compilation steps
4. Entry points and how to run the application
5. Database/ORM requirements
6. Environment configurations

**Instructions:**
- Select the MOST important files (maximum 15 files)
- Prioritize: dependency files, config files, schema files, entry points
- Don't select: node_modules, .git, dist, build folders
- Return ONLY a valid JSON array of file paths

**Examples of important files:**
- package.json, requirements.txt, go.mod (dependencies)
- tsconfig.json, next.config.js (framework configs)
- prisma/schema.prisma, drizzle.config.ts (database)
- src/index.ts, main.py (entry points)
- docker-compose.yml (existing Docker setup for reference)

**Output Format:**
Return ONLY a JSON array, nothing else. No explanations, no markdown.

Example: ["package.json", "tsconfig.json", "next.config.js", "prisma/schema.prisma"]

Your response:`;
}

