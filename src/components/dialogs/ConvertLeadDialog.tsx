import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClients } from '@/hooks/useClients';
import { useLeads } from '@/hooks/useLeads';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type Lead = Tables<'leads'>;

interface ConvertLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
}

export function ConvertLeadDialog({ open, onOpenChange, lead }: ConvertLeadDialogProps) {
  const { createClient, isCreating } = useClients();
  const { updateLead } = useLeads();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    mrr: Number(lead.proposal_value),
    industry: 'Other',
    contract_start: new Date().toISOString().split('T')[0],
  });

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    
    createClient({
      business_name: lead.business_name,
      contact_name: lead.contact_name,
      email: lead.email,
      phone: lead.phone,
      industry: formData.industry,
      mrr: formData.mrr,
      contract_start: formData.contract_start,
      converted_from_lead_id: lead.id,
      status: 'onboarding',
    }, {
      onSuccess: () => {
        // Update lead to won stage
        updateLead({ id: lead.id, stage: 'won' });
        toast({ title: 'Lead converted to client successfully!' });
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Convert Lead to Client</DialogTitle>
          <DialogDescription>
            Convert {lead.business_name} into a client. Fill in the additional details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleConvert} className="space-y-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input value={lead.business_name} disabled />
          </div>
          
          <div className="space-y-2">
            <Label>Contact</Label>
            <Input value={`${lead.contact_name} (${lead.email})`} disabled />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mrr">Monthly Retainer ($)</Label>
              <Input
                id="mrr"
                type="number"
                value={formData.mrr}
                onChange={(e) => setFormData({ ...formData, mrr: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract_start">Contract Start Date</Label>
            <Input
              id="contract_start"
              type="date"
              value={formData.contract_start}
              onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Converting...' : 'Convert to Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
