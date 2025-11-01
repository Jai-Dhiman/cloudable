/**
 * Utility functions for PDF generation
 */
export declare function hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
};
export declare function formatScore(score: number, maxScore?: number, showMax?: boolean): string;
export declare function truncateText(text: string, maxLength?: number): string;
export declare function safeText(text: string | undefined | null): string;
export declare function inchesToPoints(inches: number): number;
export declare function getStatusIcon(condition: boolean): string;
export declare function capitalizeFirst(text: string): string;
//# sourceMappingURL=utils.d.ts.map