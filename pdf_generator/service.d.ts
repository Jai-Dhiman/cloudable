import type { ProjectAnalysis } from '../src/types/analysis.js';
export declare class PDFGeneratorService {
    private registry;
    constructor(templatesDir?: string);
    initialize(): Promise<void>;
    listAvailableTemplates(): Array<{
        id: string;
        name: string;
        description: string;
        version: string;
    }>;
    generatePDF(analysis: ProjectAnalysis, templateId?: string): Promise<Buffer>;
    private createContext;
    private generateRecommendations;
}
//# sourceMappingURL=service.d.ts.map