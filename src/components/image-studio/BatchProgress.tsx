import React from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Loader2, SkipForward } from 'lucide-react';

interface BatchProgressProps {
  total: number;
  approved: number;
  skipped: number;
  generating: number;
  currentIndex: number;
}

export function BatchProgress({ total, approved, skipped, generating, currentIndex }: BatchProgressProps) {
  const completed = approved + skipped;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground">Batch Progress</h3>
        <span className="text-sm text-muted-foreground">
          {currentIndex} of {total}
        </span>
      </div>
      
      <Progress value={percentage} className="h-2 mb-3" />
      
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-muted-foreground">{approved} approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <SkipForward className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{skipped} skipped</span>
        </div>
        {generating > 0 && (
          <div className="flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-muted-foreground">{generating} generating</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Circle className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{total - completed - generating} remaining</span>
        </div>
      </div>
    </div>
  );
}
