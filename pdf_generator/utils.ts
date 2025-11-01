/**
 * Utility functions for PDF generation
 */

export function hexToRgb(hex: string): {r: number; g: number; b: number} {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : {r: 0, g: 0, b: 0}
}

export function formatScore(score: number, maxScore: number = 100, showMax: boolean = true): string {
  if (score > 0) {
    if (showMax) {
      return `${Math.round(score)}/${Math.round(maxScore)}`
    }
    return `${Math.round(score)}`
  }
  return showMax ? `--/${Math.round(maxScore)}` : '--'
}

export function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength - 3) + '...'
}

export function safeText(text: string | undefined | null): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function inchesToPoints(inches: number): number {
  return inches * 72 // 1 inch = 72 points
}

export function getStatusIcon(condition: boolean): string {
  return condition ? '✓' : '✗'
}

export function capitalizeFirst(text: string): string {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

