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
import { useAdLaunches } from '@/hooks/useAdLaunches';
import { useClients } from '@/hooks/useClients';
import { Database } from '@/integrations/supabase/types';

type AdPlatform = Database['public']['Enums']['ad_platform'];
type CampaignType = Database['public']['Enums']['campaign_type'];

const adLaunchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  client_id: z.string().min(1, 'Client is required'),
  platform: z.string().min(1, 'Platform is required'),
  campaign_type: z.string().min(1, 'Campaign type is required'),
  budget: z.number().min(0, 'Budget must be positive'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  ad_account_link: z.string().optional(),
  notes: z.string().optional(),
});

type AdLaunchFormData = z.infer<typeof adLaunchSchema>;

interface AddAdLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string;
}

const platforms: { value: AdPlatform; label: string }[] = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const campaignTypes: { value: CampaignType; label: string }[] = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'leads', label: 'Lead Generation' },
  { value: 'sales', label: 'Sales' },
];

export function AddAdLaunchDialog({ open, onOpenChange, preselectedClientId }: AddAdLaunchDialogProps) {
  const { createAdLaunch, isCreating } = useAdLaunches();
  const { clients } = useClients();
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [selectedCampaignType, setSelectedCampaignType] = useState<string>('');
  
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<AdLaunchFormData>({
    resolver: zodResolver(adLaunchSchema),
    defaultValues: {
      client_id: preselectedClientId || '',
      budget: 0,
    },
  });

  const onSubmit = (data: AdLaunchFormData) => {
    createAdLaunch({
      name: data.name,
      client_id: data.client_id,
      platform: data.platform as AdPlatform,
      campaign_type: data.campaign_type as CampaignType,
      budget: data.budget,
      start_date: data.start_date,
      end_date: data.end_date || null,
      ad_account_link: data.ad_account_link || null,
      notes: data.notes || null,
      status: 'draft',
    }, {
      onSuccess: () => {
        reset();
        setSelectedClientId('');
        setSelectedPlatform('');
        setSelectedCampaignType('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>New Ad Campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                {...register('name')}
                className="bg-secondary border-border"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select 
                value={selectedClientId} 
                onValueChange={(value) => {
                  setSelectedClientId(value);
                  setValue('client_id', value);
                }}
                disabled={!!preselectedClientId}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && (
                <p className="text-sm text-destructive">{errors.client_id.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform *</Label>
              <Select 
                value={selectedPlatform} 
                onValueChange={(value) => {
                  setSelectedPlatform(value);
                  setValue('platform', value);
                }}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.platform && (
                <p className="text-sm text-destructive">{errors.platform.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Campaign Type *</Label>
              <Select 
                value={selectedCampaignType} 
                onValueChange={(value) => {
                  setSelectedCampaignType(value);
                  setValue('campaign_type', value);
                }}
              >
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {campaignTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.campaign_type && (
                <p className="text-sm text-destructive">{errors.campaign_type.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget ($)</Label>
              <Input
                id="budget"
                type="number"
                {...register('budget', { valueAsNumber: true })}
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                {...register('start_date')}
                className="bg-secondary border-border"
              />
              {errors.start_date && (
                <p className="text-sm text-destructive">{errors.start_date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                {...register('end_date')}
                className="bg-secondary border-border"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ad_account_link">Ad Account Link</Label>
            <Input
              id="ad_account_link"
              {...register('ad_account_link')}
              placeholder="https://..."
              className="bg-secondary border-border"
            />
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
                'Create Campaign'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
