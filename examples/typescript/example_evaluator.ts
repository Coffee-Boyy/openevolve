/**
 * Example TypeScript evaluator for OpenEvolve
 * 
 * This evaluator demonstrates how to write evaluators in TypeScript
 * for the native TypeScript backend.
 */

import * as fs from 'fs';

/**
 * Main evaluation function
 * 
 * @param programPath - Path to the program file to evaluate
 * @returns Object with numeric metrics (must include 'combined_score')
 */
export async function evaluate(programPath: string): Promise<Record<string, number>> {
  try {
    // Read the program code
    const code = fs.readFileSync(programPath, 'utf8');
    
    // Example: Evaluate based on code quality metrics
    const metrics = {
      code_length: code.length,
      complexity: calculateComplexity(code),
      readability: calculateReadability(code),
    };
    
    // Calculate combined score (required for evolution guidance)
    const combined_score = 
      (1.0 - Math.min(metrics.code_length / 1000, 1.0)) * 0.3 +
      (1.0 - Math.min(metrics.complexity / 50, 1.0)) * 0.3 +
      metrics.readability * 0.4;
    
    return {
      ...metrics,
      combined_score,
    };
  } catch (error) {
    console.error('Evaluation error:', error);
    return {
      error: 1.0,
      combined_score: 0.0,
    };
  }
}

/**
 * Optional: Stage 1 cascade evaluation (fast filtering)
 */
export async function evaluate_stage1(programPath: string): Promise<Record<string, number>> {
  const code = fs.readFileSync(programPath, 'utf8');
  
  // Quick syntax and basic checks
  const isValid = code.length > 0 && code.length < 10000;
  
  return {
    stage1_passed: isValid ? 1.0 : 0.0,
    code_length: code.length,
  };
}

/**
 * Optional: Stage 2 cascade evaluation (moderate complexity)
 */
export async function evaluate_stage2(programPath: string): Promise<Record<string, number>> {
  const code = fs.readFileSync(programPath, 'utf8');
  
  // More detailed analysis
  const complexity = calculateComplexity(code);
  
  return {
    stage2_passed: complexity < 30 ? 1.0 : 0.5,
    complexity,
  };
}

// Helper functions
function calculateComplexity(code: string): number {
  // Simple cyclomatic complexity approximation
  const controlFlowKeywords = ['if', 'for', 'while', 'case', 'catch', '&&', '||'];
  let complexity = 1;
  
  for (const keyword of controlFlowKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    const matches = code.match(regex);
    complexity += matches ? matches.length : 0;
  }
  
  return complexity;
}

function calculateReadability(code: string): number {
  // Simple readability score based on line length and comments
  const lines = code.split('\n');
  const avgLineLength = lines.reduce((sum, line) => sum + line.length, 0) / lines.length;
  const commentLines = lines.filter(line => line.trim().startsWith('//')).length;
  const commentRatio = commentLines / lines.length;
  
  // Prefer moderate line lengths and some comments
  const lengthScore = 1.0 - Math.abs(avgLineLength - 60) / 100;
  const commentScore = Math.min(commentRatio * 3, 1.0);
  
  return Math.max(0, Math.min(1, (lengthScore * 0.7 + commentScore * 0.3)));
}
