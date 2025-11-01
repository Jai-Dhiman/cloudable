import * as fs from 'fs';
import * as path from 'path';
import type { DirectoryTree, ProjectFile } from '../types/ai.types.js';

export class FileAnalyzer {
  /**
   * Get a tree representation of the directory structure
   * Skip common ignore directories
   */
  static getDirectoryTree(
    dir: string = '.',
    maxDepth: number = 4,
    currentDepth: number = 0
  ): string {
    if (currentDepth >= maxDepth) return '';

    const ignoreList = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'out',
      '__pycache__',
      'venv',
      '.venv',
      'env',
      'target',
      '.terraform',
      'coverage',
      '.cache',
      '.nuxt',
      '.output'
    ];

    let tree = '';
    const indent = '  '.repeat(currentDepth);

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        // Skip ignored directories and hidden files at root
        if (ignoreList.includes(item)) continue;
        if (currentDepth === 0 && item.startsWith('.') && item !== '.env.example') continue;

        const fullPath = path.join(dir, item);
        
        try {
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            tree += `${indent}📁 ${item}/\n`;
            tree += this.getDirectoryTree(fullPath, maxDepth, currentDepth + 1);
          } else {
            tree += `${indent}📄 ${item}\n`;
          }
        } catch (error) {
          // Skip if can't stat (permission issues, etc.)
          continue;
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }

    return tree;
  }

  /**
   * Read multiple files and return their contents
   */
  static readFiles(filePaths: string[]): ProjectFile[] {
    const files: ProjectFile[] = [];

    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          files.push({
            path: filePath,
            content
          });
        } else {
          console.warn(`File not found: ${filePath}`);
        }
      } catch (error: any) {
        console.error(`Error reading ${filePath}:`, error.message);
      }
    }

    return files;
  }

  /**
   * Check if a path is safe to read (not in ignore list)
   */
  static isSafePath(filePath: string): boolean {
    const unsafePaths = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      '__pycache__',
      'venv',
      '.env' // Don't read actual .env (only .env.example is ok)
    ];

    return !unsafePaths.some(unsafe => filePath.includes(unsafe));
  }
}

