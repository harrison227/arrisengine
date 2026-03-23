import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, Facebook, Video, Target, Package, FolderOpen, Users } from 'lucide-react';

export interface OnboardingConfig {
  platforms: {
    facebook: boolean;
    tiktok: boolean;
    google: boolean;
    youtube: boolean;
    instagram: boolean;
  };
  assetNeeds: {
    rawFootage: boolean;
    productShipment: boolean;
    brandAssets: boolean;
    ugc: boolean;
  };
  customNote: string;
}

interface OnboardingConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: OnboardingConfig) => void;
  isGenerating: boolean;
  clientName?: string;
}

const defaultConfig: OnboardingConfig = {
  platforms: {
    facebook: true,
    tiktok: true,
    google: false,
    youtube: false,
    instagram: false,
  },
  assetNeeds: {
    rawFootage: false,
    productShipment: false,
    brandAssets: false,
    ugc: false,
  },
  customNote: '',
};

export function OnboardingConfigDialog({
  open,
  onOpenChange,
  onGenerate,
  isGenerating,
  clientName,
}: OnboardingConfigDialogProps) {
  const [config, setConfig] = useState<OnboardingConfig>(defaultConfig);

  const handlePlatformChange = (platform: keyof OnboardingConfig['platforms'], checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      platforms: { ...prev.platforms, [platform]: checked },
    }));
  };

  const handleAssetChange = (asset: keyof OnboardingConfig['assetNeeds'], checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      assetNeeds: { ...prev.assetNeeds, [asset]: checked },
    }));
  };

  const handleGenerate = () => {
    onGenerate(config);
  };

  const platforms = [
    { key: 'facebook' as const, label: 'Facebook Ads', icon: Facebook },
    { key: 'tiktok' as const, label: 'TikTok Ads', icon: Video },
    { key: 'google' as const, label: 'Google Ads', icon: Target },
    { key: 'youtube' as const, label: 'YouTube', icon: Video },
    { key: 'instagram' as const, label: 'Instagram', icon: Users },
  ];

  const assetOptions = [
    { key: 'rawFootage' as const, label: 'Need Raw Footage from Client', icon: Video, description: 'Client will provide video/photo assets' },
    { key: 'productShipment' as const, label: 'Product Shipment Required', icon: Package, description: 'Physical products needed for content' },
    { key: 'brandAssets' as const, label: 'Access to Brand Assets Portal', icon: FolderOpen, description: 'Logos, fonts, style guides, etc.' },
    { key: 'ugc' as const, label: 'User-Generated Content Needed', icon: Users, description: 'Customer testimonials or reviews' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Onboarding Packet</DialogTitle>
          <DialogDescription>
            Customize the onboarding document for {clientName || 'this client'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Platform Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Select Platforms</Label>
            <p className="text-xs text-muted-foreground">Only selected platforms will have setup instructions included</p>
            <div className="grid grid-cols-2 gap-3">
              {platforms.map(({ key, label, icon: Icon }) => (
                <div
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    config.platforms[key] 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => handlePlatformChange(key, !config.platforms[key])}
                >
                  <Checkbox
                    checked={config.platforms[key]}
                    onCheckedChange={(checked) => handlePlatformChange(key, !!checked)}
                  />
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Requirements */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Asset Requirements</Label>
            <p className="text-xs text-muted-foreground">Select what you need from the client</p>
            <div className="space-y-2">
              {assetOptions.map(({ key, label, icon: Icon, description }) => (
                <div
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    config.assetNeeds[key] 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onClick={() => handleAssetChange(key, !config.assetNeeds[key])}
                >
                  <Checkbox
                    checked={config.assetNeeds[key]}
                    onCheckedChange={(checked) => handleAssetChange(key, !!checked)}
                    className="mt-0.5"
                  />
                  <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{label}</span>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Note */}
          <div className="space-y-2">
            <Label htmlFor="custom-note" className="text-sm font-semibold">Custom Note (Optional)</Label>
            <Textarea
              id="custom-note"
              placeholder="Add a personal note for the client... (e.g., 'Excited to crush this together!')"
              value={config.customNote}
              onChange={(e) => setConfig(prev => ({ ...prev, customNote: e.target.value }))}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Generate Packet
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
