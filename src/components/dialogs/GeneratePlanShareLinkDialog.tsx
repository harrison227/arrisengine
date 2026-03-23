import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePlanShareLinks, PlanShareLink } from '@/hooks/usePlanShareLinks';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Link, Loader2, X } from 'lucide-react';
import { format } from 'date-fns';
import { getPublicSiteUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface GeneratePlanShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  planTitle: string;
}

export function GeneratePlanShareLinkDialog({
  open,
  onOpenChange,
  planId,
  planTitle,
}: GeneratePlanShareLinkDialogProps) {
  const [clientName, setClientName] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<PlanShareLink | null>(null);
  const { toast } = useToast();

  const { shareLinks, createShareLink, deactivateShareLink, isCreating, isLoading } = usePlanShareLinks(planId);

  const activeLinks = shareLinks.filter(link => link.is_active);

  const handleGenerateLink = async () => {
    try {
      const link = await createShareLink({
        contentPlanId: planId,
        clientName: clientName || undefined,
      });
      setGeneratedLink(link);
      setClientName('');
    } catch (error) {
      console.error('Failed to generate link:', error);
    }
  };

  const getShareUrl = (shareId: string) => {
    return `${getPublicSiteUrl()}/approve/${shareId}`;
  };

  const handleCopyLink = async (shareId: string) => {
    try {
      await navigator.clipboard.writeText(getShareUrl(shareId));
      setCopied(true);
      toast({ title: 'Link copied to clipboard!' });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setClientName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            Share for Client Approval
          </DialogTitle>
          <DialogDescription>
            Generate a unique link to share "{planTitle}" with your client for review and approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Generate New Link Section */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name (optional)</Label>
              <Input
                id="clientName"
                placeholder="e.g., John from Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Personalize the approval page with your client's name.
              </p>
            </div>

            <Button 
              onClick={handleGenerateLink} 
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4 mr-2" />
                  Generate Share Link
                </>
              )}
            </Button>
          </div>

          {/* Newly Generated Link */}
          {generatedLink && (
            <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg space-y-3">
              <p className="text-sm font-medium text-primary">Link generated successfully!</p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={getShareUrl(generatedLink.share_id)}
                  className="font-mono text-sm"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleCopyLink(generatedLink.share_id)}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Active Links List */}
          {activeLinks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Active Links</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activeLinks.map((link) => (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {link.client_name && (
                          <Badge variant="outline" className="text-xs">
                            {link.client_name}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Created {format(new Date(link.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground truncate mt-1">
                        {getShareUrl(link.share_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleCopyLink(link.share_id)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deactivateShareLink(link.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
