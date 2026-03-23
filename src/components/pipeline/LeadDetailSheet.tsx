import { useState } from 'react';
import { Calendar, Copy, Mail, Phone, Pencil, UserPlus } from 'lucide-react';
import { Tables, Database } from '@/integrations/supabase/types';
import { useLeads } from '@/hooks/useLeads';
import { EditLeadDialog } from '@/components/dialogs/EditLeadDialog';
import { ConvertLeadDialog } from '@/components/dialogs/ConvertLeadDialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type Lead = Tables<'leads'>;
type PipelineStage = Database['public']['Enums']['pipeline_stage'];

interface LeadDetailSheetProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stages: { id: PipelineStage; title: string }[] = [
  { id: 'new', title: 'New' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'proposal', title: 'Proposal Sent' },
  { id: 'negotiating', title: 'Negotiating' },
  { id: 'won', title: 'Won' },
  { id: 'lost', title: 'Lost' },
];

export function LeadDetailSheet({ lead, open, onOpenChange }: LeadDetailSheetProps) {
  const { updateLead, isUpdating } = useLeads();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  if (!lead) return null;

  const formatDate = (date?: string | null) => {
    if (!date) return 'Not set';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleStageChange = (newStage: PipelineStage) => {
    updateLead({ id: lead.id, stage: newStage });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-xl">{lead.business_name}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact</h3>
              <div className="space-y-2">
                <p className="text-foreground font-medium">{lead.contact_name}</p>
                
                <button
                  onClick={() => copyToClipboard(lead.email, 'Email')}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full"
                >
                  <Mail className="w-4 h-4" />
                  <span className="flex-1 text-left">{lead.email}</span>
                  <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                {lead.phone && (
                  <button
                    onClick={() => copyToClipboard(lead.phone!, 'Phone')}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group w-full"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="flex-1 text-left">{lead.phone}</span>
                    <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
              </div>
            </div>

            <Separator />

            {/* Deal Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Deal Info</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Stage</span>
                  <Select
                    value={lead.stage}
                    onValueChange={handleStageChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Value</span>
                  <span className="text-lg font-semibold text-foreground">
                    ${Number(lead.proposal_value).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Source</span>
                  <span className="text-sm text-foreground">{lead.source}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Follow Up</span>
                  <span className="text-sm text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(lead.next_follow_up)}
                  </span>
                </div>
              </div>
            </div>

            {lead.notes && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h3>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{lead.notes}</p>
                </div>
              </>
            )}

            {lead.lost_reason && lead.stage === 'lost' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lost Reason</h3>
                  <p className="text-sm text-destructive">{lead.lost_reason}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Lead
              </Button>

              {lead.stage !== 'won' && lead.stage !== 'lost' && (
                <Button
                  className="flex-1"
                  onClick={() => setConvertOpen(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Convert
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
    </>
  );
}
