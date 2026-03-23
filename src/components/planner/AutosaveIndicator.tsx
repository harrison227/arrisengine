import React, { useEffect, useState } from 'react';
import { Check, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutosaveIndicatorProps {
  isSaving?: boolean;
  lastSaved?: Date | null;
  className?: string;
}

export function AutosaveIndicator({ isSaving, lastSaved, className }: AutosaveIndicatorProps) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (lastSaved) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  if (isSaving) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
        <Cloud className="w-3 h-3 animate-pulse" />
        <span>Saving...</span>
      </div>
    );
  }

  if (showSaved) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500 animate-in fade-in duration-200', className)}>
        <Check className="w-3 h-3" />
        <span>Saved</span>
      </div>
    );
  }

  return null;
}
