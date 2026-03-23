import { Check, Image, Sparkles, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

type ViewStage = 'setup' | 'concepts' | 'gallery';

interface WorkflowStepperProps {
  currentStage: ViewStage;
  onStageChange: (stage: ViewStage) => void;
  conceptsCount: number;
  generatedCount: number;
  approvedCount: number;
  canNavigateToConcepts: boolean;
  canNavigateToGallery: boolean;
}

const steps = [
  { id: 'setup' as const, label: 'Setup', icon: Settings },
  { id: 'concepts' as const, label: 'Concepts', icon: Sparkles },
  { id: 'gallery' as const, label: 'Gallery', icon: Image },
];

export function WorkflowStepper({
  currentStage,
  onStageChange,
  conceptsCount,
  generatedCount,
  approvedCount,
  canNavigateToConcepts,
  canNavigateToGallery,
}: WorkflowStepperProps) {
  const getStepStatus = (stepId: ViewStage) => {
    const stageOrder = { setup: 0, concepts: 1, gallery: 2 };
    const currentIndex = stageOrder[currentStage];
    const stepIndex = stageOrder[stepId];

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const canNavigate = (stepId: ViewStage) => {
    if (stepId === 'setup') return true;
    if (stepId === 'concepts') return canNavigateToConcepts;
    if (stepId === 'gallery') return canNavigateToGallery;
    return false;
  };

  const getStepBadge = (stepId: ViewStage) => {
    if (stepId === 'concepts' && conceptsCount > 0) {
      return conceptsCount;
    }
    if (stepId === 'gallery' && generatedCount > 0) {
      return `${approvedCount}/${generatedCount}`;
    }
    return null;
  };

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const status = getStepStatus(step.id);
        const isClickable = canNavigate(step.id);
        const badge = getStepBadge(step.id);
        const StepIcon = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step Pill */}
            <button
              onClick={() => isClickable && onStageChange(step.id)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                status === 'current' && 'bg-primary text-primary-foreground',
                status === 'completed' && 'bg-muted text-foreground',
                status === 'upcoming' && 'bg-muted/50 text-muted-foreground',
                isClickable && status !== 'current' && 'hover:bg-muted cursor-pointer',
                !isClickable && 'cursor-not-allowed opacity-50'
              )}
            >
              {status === 'completed' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <StepIcon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              {badge && (
                <span className={cn(
                  'ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold',
                  status === 'current' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/20'
                )}>
                  {badge}
                </span>
              )}
            </button>

            {/* Connector */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-6 h-0.5 mx-1',
                  getStepStatus(steps[index + 1].id) !== 'upcoming'
                    ? 'bg-primary'
                    : 'bg-border'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
