import { useState } from 'react';
import { Plus, Calendar, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContentPlans } from '@/hooks/useContentPlans';
import { AddContentPlanDialog } from '@/components/dialogs/AddContentPlanDialog';
import { EditContentPlanDialog } from '@/components/dialogs/EditContentPlanDialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Database, Tables } from '@/integrations/supabase/types';

type ContentPlanStatus = Database['public']['Enums']['content_plan_status'];
type ContentPlan = Tables<'content_plans'>;

interface ContentTabProps {
  clientId: string;
}

const planStatusColors: Record<ContentPlanStatus, string> = {
  planning: 'bg-muted text-muted-foreground',
  scheduled: 'bg-primary/10 text-primary',
  filming: 'bg-warning/10 text-warning',
  editing: 'bg-stage-contacted/10 text-stage-contacted',
  complete: 'bg-success/10 text-success',
};

export function ContentTab({ clientId }: ContentTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ContentPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<ContentPlan | null>(null);
  const { contentPlans, isLoading, deleteContentPlan, isDeleting } = useContentPlans(clientId);

  const formatDate = (date?: string | null) => {
    if (!date) return 'TBD';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = () => {
    if (deletingPlan) {
      deleteContentPlan(deletingPlan.id, {
        onSuccess: () => setDeletingPlan(null),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map(i => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Content Plans</h3>
        <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          New Plan
        </Button>
      </div>

      <div className="space-y-6">
        {contentPlans.length > 0 ? (
          contentPlans.map((plan) => (
            <div key={plan.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-foreground">{plan.title}</h4>
                    <Badge className={cn(planStatusColors[plan.status])}>
                      {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
                    </Badge>
                  </div>
                  {plan.filming_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Filming: {formatDate(plan.filming_date)}</span>
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingPlan(plan)}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Plan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setDeletingPlan(plan)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Plan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {plan.brief && (
                <p className="text-sm text-muted-foreground mb-4 bg-muted/50 p-3 rounded-lg">
                  {plan.brief}
                </p>
              )}
            </div>
          ))
        ) : (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
            <p className="text-muted-foreground mb-4">No content plans yet</p>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Create Content Plan
            </Button>
          </div>
        )}
      </div>

      <AddContentPlanDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen}
        preselectedClientId={clientId}
      />
      
      {editingPlan && (
        <EditContentPlanDialog
          open={!!editingPlan}
          onOpenChange={(open) => !open && setEditingPlan(null)}
          plan={editingPlan}
        />
      )}
      
      <ConfirmDeleteDialog
        open={!!deletingPlan}
        onOpenChange={(open) => !open && setDeletingPlan(null)}
        onConfirm={handleDelete}
        title="Delete Content Plan"
        description={`Are you sure you want to delete "${deletingPlan?.title}"? This action cannot be undone.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
