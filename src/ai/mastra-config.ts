import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables from multiple locations
// 1. Current working directory (where user runs command)
dotenv.config();

// 2. Try to load from Cloudable installation directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cloudableRoot = path.resolve(__dirname, '../..');
const cloudableEnvPath = path.join(cloudableRoot, '.env');
if (fs.existsSync(cloudableEnvPath)) {
  dotenv.config({ path: cloudableEnvPath });
}

// 3. Try home directory
const homeEnvPath = path.join(process.env.HOME || '', '.cloudable.env');
if (fs.existsSync(homeEnvPath)) {
  dotenv.config({ path: homeEnvPath });
}

/**
 * Get OpenAI API key from environment
 */
export function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  
  if (!key) {
    throw new Error(
      'OPENAI_API_KEY not found in environment variables.\n\n' +
      'Please set it using one of these methods:\n' +
      '1. Export in terminal: export OPENAI_API_KEY=sk-your-key\n' +
      '2. Add to .env in current directory\n' +
      '3. Add to .env in Cloudable installation: ' + cloudableEnvPath + '\n' +
      '4. Add to ~/.cloudable.env in your home directory'
    );
  }

  return key;
}

/**
 * Validate OpenAI API key exists
 */
export function validateOpenAIKey(): void {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY not found in environment variables.\n\n' +
      'Please set it using one of these methods:\n' +
      '1. Export in terminal: export OPENAI_API_KEY=sk-your-key\n' +
      '2. Add to .env in current directory\n' +
      '3. Add to .env in Cloudable installation: ' + cloudableEnvPath + '\n' +
      '4. Add to ~/.cloudable.env in your home directory'
    );
  }
}

