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
import { useAdLaunches } from '@/hooks/useAdLaunches';
import { Tables, Database } from '@/integrations/supabase/types';

type AdLaunch = Tables<'ad_launches'>;
type AdStatus = Database['public']['Enums']['ad_status'];
type AdPlatform = Database['public']['Enums']['ad_platform'];
type CampaignType = Database['public']['Enums']['campaign_type'];

interface EditAdLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adLaunch: AdLaunch;
}

export function EditAdLaunchDialog({ open, onOpenChange, adLaunch }: EditAdLaunchDialogProps) {
  const { updateAdLaunch, isUpdating } = useAdLaunches(adLaunch.client_id);
  
  const [formData, setFormData] = useState({
    name: adLaunch.name,
    platform: adLaunch.platform,
    campaign_type: adLaunch.campaign_type,
    budget: Number(adLaunch.budget),
    start_date: adLaunch.start_date,
    end_date: adLaunch.end_date || '',
    status: adLaunch.status,
    ad_account_link: adLaunch.ad_account_link || '',
    notes: adLaunch.notes || '',
  });

  useEffect(() => {
    setFormData({
      name: adLaunch.name,
      platform: adLaunch.platform,
      campaign_type: adLaunch.campaign_type,
      budget: Number(adLaunch.budget),
      start_date: adLaunch.start_date,
      end_date: adLaunch.end_date || '',
      status: adLaunch.status,
      ad_account_link: adLaunch.ad_account_link || '',
      notes: adLaunch.notes || '',
    });
  }, [adLaunch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAdLaunch({
      id: adLaunch.id,
      name: formData.name,
      platform: formData.platform,
      campaign_type: formData.campaign_type,
      budget: formData.budget,
      start_date: formData.start_date,
      end_date: formData.end_date || null,
      status: formData.status,
      ad_account_link: formData.ad_account_link || null,
      notes: formData.notes || null,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Ad Campaign</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(value: AdPlatform) => setFormData({ ...formData, platform: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign_type">Campaign Type</Label>
                <Select
                  value={formData.campaign_type}
                  onValueChange={(value: CampaignType) => setFormData({ ...formData, campaign_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awareness">Awareness</SelectItem>
                    <SelectItem value="traffic">Traffic</SelectItem>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: AdStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad_account_link">Ad Account Link</Label>
              <Input
                id="ad_account_link"
                type="url"
                value={formData.ad_account_link}
                onChange={(e) => setFormData({ ...formData, ad_account_link: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
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
