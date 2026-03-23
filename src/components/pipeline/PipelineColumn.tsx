import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type PipelineStage = Database['public']['Enums']['pipeline_stage'];

interface PipelineColumnProps {
  stage: PipelineStage;
  title: string;
  count: number;
  value: number;
  children: ReactNode;
  onDrop?: (leadId: string, newStage: PipelineStage) => void;
}

const stageColors: Record<PipelineStage, string> = {
  new: 'bg-stage-new',
  contacted: 'bg-stage-contacted',
  proposal: 'bg-stage-proposal',
  negotiating: 'bg-stage-negotiating',
  won: 'bg-stage-won',
  lost: 'bg-stage-lost',
};

export function PipelineColumn({ stage, title, count, value, children, onDrop }: PipelineColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const leadId = e.dataTransfer.getData('leadId');
    const sourceStage = e.dataTransfer.getData('sourceStage');
    
    if (leadId && sourceStage !== stage && onDrop) {
      onDrop(leadId, stage);
    }
  };

  return (
    <div 
      className={cn(
        "flex-1 min-w-[280px] max-w-[320px] transition-all duration-200",
        isDragOver && "scale-[1.02]"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className={cn('w-2 h-2 rounded-full', stageColors[stage])} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">${value.toLocaleString()}</p>
      </div>
      
      <div 
        className={cn(
          "space-y-3 min-h-[200px] p-2 -m-2 rounded-lg transition-all duration-200",
          isDragOver && "bg-primary/10 border-2 border-dashed border-primary/40"
        )}
      >
        {children}
        
        {isDragOver && (
          <div className="flex items-center justify-center py-8 text-sm text-primary font-medium">
            Drop here to move to {title}
          </div>
        )}
      </div>
    </div>
  );
}
