import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { Tables, Database } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;
type ClientStatus = Database['public']['Enums']['client_status'];

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
}

const statuses: ClientStatus[] = ['onboarding', 'active', 'paused', 'churned'];
const industries = ['SaaS', 'E-commerce', 'Finance', 'Healthcare', 'Real Estate', 'Education', 'Other'];

export function EditClientDialog({ open, onOpenChange, client }: EditClientDialogProps) {
  const { updateClient, isUpdating } = useClients();
  const [formData, setFormData] = useState({
    business_name: '',
    contact_name: '',
    email: '',
    phone: '',
    website: '',
    industry: '',
    status: 'onboarding' as ClientStatus,
    mrr: 0,
    contract_start: '',
    contract_end: '',
    is_personal: false,
  });

  useEffect(() => {
    if (client) {
      setFormData({
        business_name: client.business_name,
        contact_name: client.contact_name,
        email: client.email,
        phone: client.phone || '',
        website: client.website || '',
        industry: client.industry,
        status: client.status,
        mrr: Number(client.mrr),
        contract_start: client.contract_start || '',
        contract_end: client.contract_end || '',
        is_personal: (client as any).is_personal || false,
      });
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClient({
      id: client.id,
      ...formData,
      contract_start: formData.contract_start || null,
      contract_end: formData.contract_end || null,
      phone: formData.phone || null,
      website: formData.website || null,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_name">Business Name</Label>
              <Input
                id="business_name"
                value={formData.business_name}
                onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select value={formData.industry} onValueChange={(value) => setFormData({ ...formData, industry: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as ClientStatus })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mrr">Monthly Retainer ($)</Label>
              <Input
                id="mrr"
                type="number"
                value={formData.mrr}
                onChange={(e) => setFormData({ ...formData, mrr: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract_start">Contract Start</Label>
              <Input
                id="contract_start"
                type="date"
                value={formData.contract_start}
                onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract_end">Contract End</Label>
              <Input
                id="contract_end"
                type="date"
                value={formData.contract_end}
                onChange={(e) => setFormData({ ...formData, contract_end: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-secondary/50">
            <div>
              <Label htmlFor="edit_is_personal" className="text-sm font-medium">Personal / Test Client</Label>
              <p className="text-xs text-muted-foreground">Won't count towards MRR or client totals</p>
            </div>
            <Switch
              id="edit_is_personal"
              checked={formData.is_personal}
              onCheckedChange={(checked) => setFormData({ ...formData, is_personal: checked })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
