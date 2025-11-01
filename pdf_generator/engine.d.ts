import type { TemplateContext } from './types.js';
import { TemplateLoader as LoaderClass } from './loader.js';
export declare class TemplateEngine {
    private loader;
    private styles;
    constructor(loader: LoaderClass);
    private buildStyles;
    render(context: TemplateContext): Promise<Buffer>;
    private renderSections;
    private renderSection;
    private _renderHeader;
    private _renderTitle;
    private _renderSummary;
    private _renderFramework;
    private _renderServices;
    private _renderBuildConfig;
    private _renderDeploymentDocs;
    private _renderEnvironmentVars;
    private _renderRecommendations;
    private _renderPageBreak;
}
//# sourceMappingURL=engine.d.ts.map