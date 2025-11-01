/**
 * Template Registry - Manages available PDF report templates
 */
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { readFile } from 'fs/promises';
export class TemplateRegistry {
    templatesDir;
    templates = new Map();
    constructor(templatesDir) {
        this.templatesDir = templatesDir;
    }
    async loadTemplates() {
        try {
            const entries = await readdir(this.templatesDir);
            for (const entry of entries) {
                const entryPath = join(this.templatesDir, entry);
                const stats = await stat(entryPath);
                if (stats.isDirectory() && !entry.startsWith('_')) {
                    const configPath = join(entryPath, 'template.json');
                    try {
                        const configContent = await readFile(configPath, 'utf-8');
                        const config = JSON.parse(configContent);
                        config.path = entryPath;
                        config.id = config.id || entry;
                        this.templates.set(config.id, config);
                        console.log(`Loaded template: ${config.id}`);
                    }
                    catch (error) {
                        console.warn(`Failed to load template from ${configPath}: ${error}`);
                    }
                }
            }
        }
        catch (error) {
            console.warn(`Templates directory does not exist or cannot be read: ${this.templatesDir}`);
        }
    }
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    listTemplates() {
        return Array.from(this.templates.values()).map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            version: template.version,
        }));
    }
    templateExists(templateId) {
        return this.templates.has(templateId);
    }
}
//# sourceMappingURL=registry.js.map