import type { SectionConfig } from './types.js';
export declare class TemplateLoader {
    private templatePath;
    private config;
    constructor(templatePath: string);
    loadConfig(): Promise<void>;
    loadSection(sectionName: string): Promise<SectionConfig | null>;
    getLayoutConfig(): import("./types.js").LayoutConfig;
    getStylesConfig(): import("./types.js").StylesConfig;
    getSectionsOrder(): string[];
    getMetadata(): {
        id: string;
        name: string;
        version: string;
        description: string;
    };
}
//# sourceMappingURL=loader.d.ts.map