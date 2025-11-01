/**
 * Utility functions for PDF generation
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255,
        }
        : { r: 0, g: 0, b: 0 };
}
export function formatScore(score, maxScore = 100, showMax = true) {
    if (score > 0) {
        if (showMax) {
            return `${Math.round(score)}/${Math.round(maxScore)}`;
        }
        return `${Math.round(score)}`;
    }
    return showMax ? `--/${Math.round(maxScore)}` : '--';
}
export function truncateText(text, maxLength = 200) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 3) + '...';
}
export function safeText(text) {
    if (!text)
        return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
export function inchesToPoints(inches) {
    return inches * 72; // 1 inch = 72 points
}
export function getStatusIcon(condition) {
    return condition ? '✓' : '✗';
}
export function capitalizeFirst(text) {
    if (!text)
        return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}
//# sourceMappingURL=utils.js.map