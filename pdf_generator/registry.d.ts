import type { TemplateConfig } from './types.js';
export declare class TemplateRegistry {
    private templatesDir;
    private templates;
    constructor(templatesDir: string);
    loadTemplates(): Promise<void>;
    getTemplate(templateId: string): TemplateConfig | undefined;
    listTemplates(): Array<{
        id: string;
        name: string;
        description: string;
        version: string;
    }>;
    templateExists(templateId: string): boolean;
}
//# sourceMappingURL=registry.d.ts.map