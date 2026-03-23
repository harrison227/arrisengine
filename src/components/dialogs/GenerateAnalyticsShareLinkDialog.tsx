import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Copy, Check, Link2, Share2, ExternalLink } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useClients } from '@/hooks/useClients';
import { useAnalyticsShareLinks } from '@/hooks/useAnalyticsShareLinks';
import { fetchPublicConfig } from '@/lib/publicConfig';
import { cn, getPublicSiteUrl } from '@/lib/utils';

interface GenerateAnalyticsShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string;
  preselectedDateRange?: { from: string; to: string };
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'twitter', label: 'Twitter/X' },
  { id: 'linkedin', label: 'LinkedIn' },
];

export function GenerateAnalyticsShareLinkDialog({
  open,
  onOpenChange,
  preselectedClientId,
  preselectedDateRange,
}: GenerateAnalyticsShareLinkDialogProps) {
  const { clients } = useClients();
  const { createShareLink } = useAnalyticsShareLinks();

  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [startDate, setStartDate] = useState<Date>(
    preselectedDateRange ? new Date(preselectedDateRange.from) : subDays(new Date(), 30)
  );
  const [endDate, setEndDate] = useState<Date>(
    preselectedDateRange ? new Date(preselectedDateRange.to) : new Date()
  );
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [generatedShareId, setGeneratedShareId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Update dates when preselected range changes
  useEffect(() => {
    if (preselectedDateRange) {
      setStartDate(new Date(preselectedDateRange.from));
      setEndDate(new Date(preselectedDateRange.to));
    }
  }, [preselectedDateRange]);

  useEffect(() => {
    if (preselectedClientId) {
      setSelectedClientId(preselectedClientId);
    }
  }, [preselectedClientId]);

  const getShareUrl = (shareId: string) => `${getPublicSiteUrl()}/analytics/${shareId}`;

  const handleGenerate = async () => {
    if (!selectedClientId) return;

    setIsCreating(true);
    try {
      await fetchPublicConfig();

      const result = await createShareLink.mutateAsync({
        clientId: selectedClientId,
        dateRangeStart: format(startDate, 'yyyy-MM-dd'),
        dateRangeEnd: format(endDate, 'yyyy-MM-dd'),
        expiresAt: expiresAt ? format(expiresAt, 'yyyy-MM-dd') : null,
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms : null,
      });

      setGeneratedShareId(result.share_id);
    } catch (error) {
      console.error('Failed to generate share link:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedShareId) return;

    const url = getShareUrl(generatedShareId);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedShareId(null);
    setCopied(false);
    setSelectedPlatforms([]);
    setExpiresAt(undefined);
    if (!preselectedClientId) {
      setSelectedClientId('');
    }
    onOpenChange(false);
  };

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const connectedClients = clients?.filter((c) => c.late_api_key) || [];
  const generatedUrl = generatedShareId ? getShareUrl(generatedShareId) : '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Analytics
          </DialogTitle>
          <DialogDescription>
            Create a shareable link for your client to view their analytics dashboard.
          </DialogDescription>
        </DialogHeader>

        {!generatedShareId ? (
          <div className="space-y-4 py-4">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                disabled={!!preselectedClientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {connectedClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !startDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !endDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Platform Filter (Optional) */}
            <div className="space-y-2">
              <Label>Filter Platforms (optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORMS.map((platform) => (
                  <div key={platform.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={platform.id}
                      checked={selectedPlatforms.includes(platform.id)}
                      onCheckedChange={() => togglePlatform(platform.id)}
                    />
                    <label
                      htmlFor={platform.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {platform.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Expiration Date (Optional) */}
            <div className="space-y-2">
              <Label>Expires On (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !expiresAt && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiresAt ? format(expiresAt, 'MMM d, yyyy') : 'Never expires'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={expiresAt}
                    onSelect={setExpiresAt}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={!selectedClientId || isCreating}
            >
              {isCreating ? 'Generating...' : 'Generate Link'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <p className="text-sm text-success font-medium mb-2">
                Link generated for {selectedClient?.business_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
                {selectedPlatforms.length > 0 && (
                  <span className="block mt-1">
                    Platforms: {selectedPlatforms.join(', ')}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border truncate"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(generatedUrl, '_blank')}
                className="shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" className="w-full" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
