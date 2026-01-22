/**
 * Utility functions for the evolution engine
 */

/**
 * Calculate edit distance between two strings (Levenshtein distance)
 */
export function calculateEditDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[len1][len2];
}

/**
 * Calculate safe numeric average of metrics
 */
export function safeNumericAverage(metrics: Record<string, number>): number {
  const numericValues = Object.values(metrics).filter(
    (v) => typeof v === 'number' && !isNaN(v) && v !== Infinity && v !== -Infinity
  );
  return numericValues.length > 0
    ? numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length
    : 0.0;
}

/**
 * Get fitness score for a program (excluding feature dimensions)
 */
export function getFitnessScore(
  metrics: Record<string, number>,
  featureDimensions: string[]
): number {
  // Use combined_score if available
  if ('combined_score' in metrics) {
    return metrics.combined_score;
  }

  // Otherwise, average all numeric metrics excluding feature dimensions
  const excludeKeys = new Set(featureDimensions);
  const relevantMetrics: Record<string, number> = {};

  for (const [key, value] of Object.entries(metrics)) {
    if (!excludeKeys.has(key) && typeof value === 'number') {
      relevantMetrics[key] = value;
    }
  }

  return safeNumericAverage(relevantMetrics);
}

/**
 * Format metrics as a string (compact format)
 */
export function formatMetrics(metrics: Record<string, number>): string {
  const formatted: string[] = [];
  for (const [name, value] of Object.entries(metrics)) {
    if (typeof value === 'number') {
      formatted.push(`${name}=${value.toFixed(4)}`);
    } else {
      formatted.push(`${name}=${value}`);
    }
  }
  return formatted.join(', ');
}

/**
 * Format metrics as multiline string (for prompts)
 */
export function formatMetricsMultiline(metrics: Record<string, number>): string {
  const formatted: string[] = [];
  for (const [name, value] of Object.entries(metrics)) {
    if (typeof value === 'number') {
      formatted.push(`- ${name}: ${value.toFixed(4)}`);
    } else {
      formatted.push(`- ${name}: ${value}`);
    }
  }
  return formatted.join('\n');
}

/**
 * Format feature coordinates as a string
 */
export function formatFeatureCoordinates(
  metrics: Record<string, number>,
  featureDimensions: string[]
): string {
  const coords: string[] = [];
  for (const dim of featureDimensions) {
    const value = metrics[dim];
    if (value !== undefined) {
      coords.push(`${dim}=${typeof value === 'number' ? value.toFixed(4) : value}`);
    }
  }
  return coords.join(', ');
}

/**
 * Extract code from LLM response (code blocks)
 */
export function extractCode(response: string, language?: string): string | null {
  const pattern = language
    ? new RegExp(`\`\`\`${language}\\n([\\s\\S]*?)\\n\`\`\``, 'g')
    : /```(?:\w+)?\n([\s\S]*?)\n```/g;

  const match = pattern.exec(response);
  return match ? match[1] : null;
}

/**
 * Parse diff-based code modifications
 */
export function parseDiff(response: string, diffPattern: string): Array<{ search: string; replace: string }> {
  const pattern = new RegExp(diffPattern, 'gs');
  const matches = [...response.matchAll(pattern)];

  return matches.map((match) => ({
    search: match[1],
    replace: match[2],
  }));
}

/**
 * Apply diffs to code
 */
export function applyDiffs(
  originalCode: string,
  diffs: Array<{ search: string; replace: string }>
): string {
  let result = originalCode;

  for (const diff of diffs) {
    result = result.replace(diff.search, diff.replace);
  }

  return result;
}

/**
 * Detect programming language from code
 */
export function detectLanguage(code: string): string {
  if (code.includes('def ') || code.includes('import ')) return 'python';
  if (code.includes('function ') || code.includes('const ')) return 'javascript';
  if (code.includes('interface ') || code.includes(': string')) return 'typescript';
  if (code.includes('public class') || code.includes('System.out')) return 'java';
  return 'unknown';
}
