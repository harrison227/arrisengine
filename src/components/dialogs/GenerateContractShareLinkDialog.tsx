import { useState } from 'react';
import { Copy, Link, Check, X, Loader2, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useContractShareLinks, ContractShareLink } from '@/hooks/useContractShareLinks';
import { getPublicSiteUrl } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface GenerateContractShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  contractTitle: string;
}

export function GenerateContractShareLinkDialog({
  open,
  onOpenChange,
  contractId,
  contractTitle,
}: GenerateContractShareLinkDialogProps) {
  const { shareLinks, isLoading, error, refetch, createShareLink, deactivateShareLink, isCreating } = useContractShareLinks(contractId);
  const { toast } = useToast();
  const [expiryDays, setExpiryDays] = useState('30');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreateLink = () => {
    const expiresAt = expiryDays 
      ? new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    
    createShareLink({ contractId, expiresAt });
  };

  const getShareUrl = (link: ContractShareLink) => {
    return `${getPublicSiteUrl()}/contract/${link.share_id}`;
  };

  const handleCopy = async (link: ContractShareLink) => {
    try {
      const url = getShareUrl(link);
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      toast({ title: 'Link copied to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleOpenLink = (link: ContractShareLink) => {
    const url = getShareUrl(link);
    window.open(url, '_blank');
  };

  const activeLinks = shareLinks.filter(l => l.is_active);

  // Truncate title for display
  const displayTitle = contractTitle.length > 40 ? contractTitle.slice(0, 40) + '...' : contractTitle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col p-0 gap-0 w-[min(95vw,480px)] max-w-none max-h-[calc(100dvh-2rem)] overflow-hidden">
        {/* Fixed Header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 pr-12 border-b">
          <DialogTitle>Share Contract for Signing</DialogTitle>
          <DialogDescription className="break-words">
            Generate a secure link to share "<span className="font-medium" title={contractTitle}>{displayTitle}</span>" for digital signing.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-6">
          {/* Create new link section */}
          <div className="space-y-3">
            <Label>Link Expiry</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min="1"
                max="365"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                placeholder="Days"
                className="w-24 flex-shrink-0"
              />
              <span className="text-sm text-muted-foreground">days</span>
              <div className="flex-1" />
              <Button 
                onClick={handleCreateLink} 
                disabled={isCreating}
                className="flex-shrink-0"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Link className="w-4 h-4 mr-2" />
                )}
                Generate Link
              </Button>
            </div>
          </div>

          {/* Active Share Links Section - Always shown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Active Share Links</Label>
              {error && (
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              )}
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Failed to load share links</span>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && activeLinks.length === 0 && (
              <div className="p-4 border rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
                No active share links yet. Click "Generate Link" to create one.
              </div>
            )}

            {/* Links List */}
            {!isLoading && !error && activeLinks.length > 0 && (
              <div className="space-y-3">
                {activeLinks.map((link) => (
                  <div 
                    key={link.id} 
                    className="p-3 border rounded-lg bg-muted/50 space-y-3"
                  >
                    {/* Share URL - Only production URL shown */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">Share URL:</div>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div 
                            className="text-xs font-mono bg-background px-2 py-1.5 rounded border break-all"
                            title={getShareUrl(link)}
                          >
                            {getShareUrl(link)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleOpenLink(link)}
                            title="Open link in new tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => handleCopy(link)}
                            title="Copy link"
                          >
                            {copiedId === link.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => deactivateShareLink(link.id)}
                            title="Deactivate link"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Meta Row */}
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Created {format(new Date(link.created_at), 'MMM d, yyyy')}
                      {link.expires_at && (
                        <> · Expires {format(new Date(link.expires_at), 'MMM d, yyyy')}</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>NSW Electronic Transactions Act Compliance:</strong> Both parties will need to confirm 
            their intent to sign and consent to electronic signing. All signatures will include an audit 
            trail with timestamps and IP addresses.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
