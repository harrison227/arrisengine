import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';

const leadSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  contact_name: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  source: z.string().min(1, 'Source is required'),
  proposal_value: z.number().min(0, 'Value must be positive'),
  notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sources = ['Website', 'Referral', 'LinkedIn', 'Cold Outreach', 'Event', 'Other'];

export function AddLeadDialog({ open, onOpenChange }: AddLeadDialogProps) {
  const { createLead, isCreating } = useLeads();
  const [selectedSource, setSelectedSource] = useState('');
  
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      proposal_value: 0,
    },
  });

  const onSubmit = (data: LeadFormData) => {
    createLead({
      business_name: data.business_name,
      contact_name: data.contact_name,
      email: data.email,
      phone: data.phone || null,
      source: data.source,
      proposal_value: data.proposal_value,
      notes: data.notes || null,
      stage: 'new',
    }, {
      onSuccess: () => {
        reset();
        setSelectedSource('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                {...register('business_name')}
                className="bg-secondary border-border"
              />
              {errors.business_name && (
                <p className="text-sm text-destructive">{errors.business_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name *</Label>
              <Input
                id="contact_name"
                {...register('contact_name')}
                className="bg-secondary border-border"
              />
              {errors.contact_name && (
                <p className="text-sm text-destructive">{errors.contact_name.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                className="bg-secondary border-border"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                className="bg-secondary border-border"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source *</Label>
              <Select 
                value={selectedSource} 
                onValueChange={(value) => {
                  setSelectedSource(value);
                  setValue('source', value);
                }}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.source && (
                <p className="text-sm text-destructive">{errors.source.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal_value">Proposal Value ($)</Label>
              <Input
                id="proposal_value"
                type="number"
                {...register('proposal_value', { valueAsNumber: true })}
                className="bg-secondary border-border"
              />
              {errors.proposal_value && (
                <p className="text-sm text-destructive">{errors.proposal_value.message}</p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              className="bg-secondary border-border min-h-[80px]"
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Lead'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
