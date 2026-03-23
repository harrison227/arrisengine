import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContentPlans } from '@/hooks/useContentPlans';
import { Tables, Database } from '@/integrations/supabase/types';

type ContentPlan = Tables<'content_plans'>;
type ContentPlanStatus = Database['public']['Enums']['content_plan_status'];

interface EditContentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: ContentPlan;
}

export function EditContentPlanDialog({ open, onOpenChange, plan }: EditContentPlanDialogProps) {
  const { updateContentPlan, isUpdating } = useContentPlans(plan.client_id);
  
  const [formData, setFormData] = useState({
    title: plan.title,
    brief: plan.brief || '',
    filming_date: plan.filming_date || '',
    status: plan.status,
  });

  useEffect(() => {
    setFormData({
      title: plan.title,
      brief: plan.brief || '',
      filming_date: plan.filming_date || '',
      status: plan.status,
    });
  }, [plan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateContentPlan({
      id: plan.id,
      title: formData.title,
      brief: formData.brief || null,
      filming_date: formData.filming_date || null,
      status: formData.status,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Content Plan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brief">Brief</Label>
              <Textarea
                id="brief"
                value={formData.brief}
                onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filming_date">Filming Date</Label>
              <Input
                id="filming_date"
                type="date"
                value={formData.filming_date}
                onChange={(e) => setFormData({ ...formData, filming_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: ContentPlanStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="filming">Filming</SelectItem>
                  <SelectItem value="editing">Editing</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
