import { useState } from 'react';
import { Calendar, MoreHorizontal, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Tables, Database } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { useLeads } from '@/hooks/useLeads';
import { EditLeadDialog } from '@/components/dialogs/EditLeadDialog';
import { ConvertLeadDialog } from '@/components/dialogs/ConvertLeadDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Lead = Tables<'leads'>;
type PipelineStage = Database['public']['Enums']['pipeline_stage'];

interface LeadCardProps {
  lead: Lead;
  onCardClick?: (lead: Lead) => void;
}

const sourceColors: Record<string, string> = {
  'Referral': 'bg-success/10 text-success',
  'Cold Outreach': 'bg-primary/10 text-primary',
  'Inbound': 'bg-warning/10 text-warning',
  'Website': 'bg-stage-contacted/10 text-stage-contacted',
  'LinkedIn': 'bg-primary/10 text-primary',
  'Event': 'bg-stage-proposal/10 text-stage-proposal',
};

export function LeadCard({ lead, onCardClick }: LeadCardProps) {
  const { deleteLead, isDeleting } = useLeads();
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const formatDate = (date?: string | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = () => {
    deleteLead(lead.id);
    setDeleteConfirmOpen(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('leadId', lead.id);
    e.dataTransfer.setData('sourceStage', lead.stage);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on the dropdown menu
    const target = e.target as HTMLElement;
    if (target.closest('[data-radix-dropdown-menu-trigger]') || target.closest('[role="menu"]')) {
      return;
    }
    onCardClick?.(lead);
  };

  return (
    <>
      <div 
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        className={cn(
          "bg-card border border-border rounded-lg p-4 cursor-grab shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 group select-none",
          isDragging && "opacity-50 rotate-2 scale-105 shadow-lg cursor-grabbing"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            {lead.business_name}
          </h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild data-radix-dropdown-menu-trigger>
              <button 
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Lead
              </DropdownMenuItem>
              {lead.stage !== 'won' && lead.stage !== 'lost' && (
                <DropdownMenuItem onClick={() => setConvertOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Convert to Client
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <p className="text-xs text-muted-foreground mb-3">{lead.contact_name}</p>
        
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            sourceColors[lead.source] || 'bg-muted text-muted-foreground'
          )}>
            {lead.source}
          </span>
          <span className="text-sm font-semibold text-foreground">
            ${Number(lead.proposal_value).toLocaleString()}
          </span>
        </div>

        {lead.next_follow_up && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>Follow up: {formatDate(lead.next_follow_up)}</span>
          </div>
        )}
      </div>

      <EditLeadDialog 
        open={editOpen} 
        onOpenChange={setEditOpen} 
        lead={lead}
      />

      <ConvertLeadDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        lead={lead}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{lead.business_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
