import { useState } from 'react';
import { Calendar as CalendarIcon, Copy, Check, Link2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
import { useClients } from '@/hooks/useClients';
import { useCalendarShareLinks } from '@/hooks/useCalendarShareLinks';
import { fetchPublicConfig } from '@/lib/publicConfig';
import { cn, getPublicSiteUrl } from '@/lib/utils';

interface GenerateShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string;
}

export function GenerateShareLinkDialog({
  open,
  onOpenChange,
  preselectedClientId,
}: GenerateShareLinkDialogProps) {
  const { clients } = useClients();
  const { createShareLink, isCreating } = useCalendarShareLinks();

  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [generatedShareId, setGeneratedShareId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getShareUrl = (shareId: string) => `${getPublicSiteUrl()}/view/${shareId}`;

  const handleGenerate = async () => {
    if (!selectedClientId) return;

    try {
      // Ensure runtime config is loaded before we show the URL.
      await fetchPublicConfig();

      const result = await createShareLink({
        clientId: selectedClientId,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });

      setGeneratedShareId(result.share_id);
    } catch (error) {
      console.error('Failed to generate share link:', error);
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
    if (!preselectedClientId) {
      setSelectedClientId('');
    }
    onOpenChange(false);
  };

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const generatedUrl = generatedShareId ? getShareUrl(generatedShareId) : '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Generate Client Link
          </DialogTitle>
          <DialogDescription>
            Create a shareable link for your client to view their content calendar.
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
                  {clients.map((client) => (
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
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={() => window.open(generatedUrl, '_blank')}
              >
                Open Link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

