/**
 * Share-link management UI for the Brand Pack tab.
 *
 * Lists existing share links, lets you create / rotate / deactivate, and
 * shows view + download counts.
 */

import { useEffect, useState } from 'react';
import { Check, Copy, Link as LinkIcon, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useBrandShareLinks } from '@/hooks/useBrandPack';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface ShareLinkManagerProps {
  clientId: string;
}

function brandPackUrl(shareId: string): string {
  return `${window.location.origin}/brand/${shareId}`;
}

export function ShareLinkManager({ clientId }: ShareLinkManagerProps) {
  const { toast } = useToast();
  const { shareLinks, isLoading, createShareLink, rotateShareLink, deactivateShareLink, isMutating } =
    useBrandShareLinks(clientId);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(null), 1500);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const handleCopy = async (shareId: string) => {
    try {
      await navigator.clipboard.writeText(brandPackUrl(shareId));
      setCopiedId(shareId);
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    try {
      await createShareLink({ allowDownloads: true });
    } catch {
      // toast already raised by hook
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Public share links</h3>
          <p className="text-xs text-muted-foreground">
            Send a link so the client can self-serve their logos, colors and fonts.
          </p>
        </div>
        <Button size="sm" onClick={handleCreate} disabled={isMutating}>
          <LinkIcon className="h-4 w-4 mr-1.5" />
          Create link
        </Button>
      </div>

      {isLoading && <div className="text-xs text-muted-foreground">Loading…</div>}

      {!isLoading && shareLinks.length === 0 && (
        <div className="text-xs text-muted-foreground italic">No share links yet.</div>
      )}

      <div className="space-y-2">
        {shareLinks.map((link) => (
          <div
            key={link.id}
            className="rounded-md border border-border p-3 flex flex-wrap items-center gap-2 text-sm"
          >
            <Badge variant={link.is_active ? 'default' : 'secondary'} className="text-xs">
              {link.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[260px]">
              {brandPackUrl(link.share_id)}
            </code>
            <span className="text-xs text-muted-foreground">
              {link.view_count} view{link.view_count === 1 ? '' : 's'} · {link.download_count} download
              {link.download_count === 1 ? '' : 's'}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              created {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(link.share_id)}>
              {copiedId === link.share_id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            {link.is_active && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => rotateShareLink(link.id)}
                  disabled={isMutating}
                  title="Rotate (mint a new URL, deactivate this one)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deactivateShareLink(link.id)}
                  disabled={isMutating}
                  title="Deactivate"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
