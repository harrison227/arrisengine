import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';

interface SavePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, strategyNotes?: string) => void;
  isSaving: boolean;
  defaultTitle?: string;
}

export function SavePlanDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
  defaultTitle = '',
}: SavePlanDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [strategyNotes, setStrategyNotes] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(title.trim(), strategyNotes.trim() || undefined);
  };

  // Reset fields when dialog opens
  React.useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setStrategyNotes('');
    }
  }, [open, defaultTitle]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            Save Content Plan
          </DialogTitle>
          <DialogDescription>
            Give your content plan a name and explain your strategy to share with your client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="plan-title">Plan Title</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., January Filming Day"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="strategy-notes">
              Strategy Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="strategy-notes"
              value={strategyNotes}
              onChange={(e) => setStrategyNotes(e.target.value)}
              placeholder="Explain your thought process, goals, and why you chose these content ideas. This will be visible to the client when you share the plan for approval."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This helps your client understand the reasoning behind your content strategy.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
            {isSaving ? 'Saving...' : 'Save Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
