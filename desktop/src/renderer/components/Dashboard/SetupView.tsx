import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import ProgramEditor from '../ProgramEditor';
import { useAppStore } from '../../store/appStore';

const INITIAL_TEMPLATES = {
  initial: `"""
Initial program template.
This is the starting point for evolution.
"""

def solve():
    """Your solution here"""
    pass


if __name__ == "__main__":
    result = solve()
    print(result)
`,
  evaluator: `"""
Evaluation function template.
This function evaluates the quality of generated programs.
"""

import subprocess
import sys
from typing import Dict


def evaluate(program_content: str) -> Dict[str, float]:
    """
    Evaluate the given program.
    
    Args:
        program_content: The source code of the program to evaluate
        
    Returns:
        Dictionary with metric name -> score mappings.
        Higher scores are better.
    """
    
    # Example: Run the program and evaluate its output
    try:
        # Execute the program
        result = subprocess.run(
            [sys.executable, "-c", program_content],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        # Calculate metrics based on output
        score = 0.0
        
        if result.returncode == 0:
            score += 0.5  # Program runs successfully
            
            # Add your evaluation logic here
            # For example, check output, performance, correctness, etc.
            output = result.stdout.strip()
            # score += evaluate_output(output)
        
        return {
            "combined_score": score,
            "success": float(result.returncode == 0),
        }
        
    except subprocess.TimeoutExpired:
        return {
            "combined_score": 0.0,
            "success": 0.0,
            "error": "timeout"
        }
    except Exception as e:
        return {
            "combined_score": 0.0,
            "success": 0.0,
            "error": str(e)
        }


if __name__ == "__main__":
    # Test the evaluator
    test_program = '''
print("Hello, World!")
'''
    
    metrics = evaluate(test_program)
    print(f"Metrics: {metrics}")
`,
};

export default function SetupView() {
  const { setupCode, setSetupCode } = useAppStore();
  const [activeTab, setActiveTab] = useState('initial');
  
  // Initialize with templates if empty
  const initialProgram = setupCode.initial || INITIAL_TEMPLATES.initial;
  const evaluator = setupCode.evaluator || INITIAL_TEMPLATES.evaluator;

  const handleInitialProgramChange = (value: string) => {
    setSetupCode('initial', value);
  };

  const handleEvaluatorChange = (value: string) => {
    setSetupCode('evaluator', value);
  };

  // Check if there are unsaved changes
  const hasInitialChanges = setupCode.initial && setupCode.initial !== INITIAL_TEMPLATES.initial;
  const hasEvaluatorChanges = setupCode.evaluator && setupCode.evaluator !== INITIAL_TEMPLATES.evaluator;

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <Tabs.List className="flex border-b border-border px-4 bg-muted/30">
          <Tabs.Trigger
            value="initial"
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary hover:text-primary/80 transition-colors relative"
          >
            Initial Program
            {hasInitialChanges && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" title="Has unsaved changes" />
            )}
          </Tabs.Trigger>
          <Tabs.Trigger
            value="evaluator"
            className="px-4 py-3 text-sm font-medium border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary hover:text-primary/80 transition-colors relative"
          >
            Evaluation Function
            {hasEvaluatorChanges && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" title="Has unsaved changes" />
            )}
          </Tabs.Trigger>
          
          {/* Info section on the right */}
          <div className="flex-1" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-4">
            <div className="flex items-center gap-2">
              <span>Initial: {initialProgram.split('\n').length} lines</span>
              <span>•</span>
              <span>Evaluator: {evaluator.split('\n').length} lines</span>
            </div>
          </div>
        </Tabs.List>

        <Tabs.Content value="initial" className="flex-1 overflow-hidden">
          <ProgramEditor
            type="initial"
            value={initialProgram}
            onChange={handleInitialProgramChange}
          />
        </Tabs.Content>

        <Tabs.Content value="evaluator" className="flex-1 overflow-hidden">
          <ProgramEditor
            type="evaluator"
            value={evaluator}
            onChange={handleEvaluatorChange}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
