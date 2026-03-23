import { useState } from 'react';
import { Link2, Plus, Copy, Check, ExternalLink, Trash2, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getPublicSiteUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCalendarShareLinks } from '@/hooks/useCalendarShareLinks';
import { GenerateShareLinkDialog } from '@/components/dialogs/GenerateShareLinkDialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface ShareLinksTabProps {
  clientId: string;
}

export function ShareLinksTab({ clientId }: ShareLinksTabProps) {
  const { shareLinks, isLoading, deactivateShareLink, deleteShareLink } = useCalendarShareLinks(clientId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const handleCopy = async (shareId: string) => {
    const link = `${getPublicSiteUrl()}/view/${shareId}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteClick = (id: string) => {
    setSelectedLinkId(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedLinkId) {
      deleteShareLink(selectedLinkId);
    }
    setDeleteDialogOpen(false);
    setSelectedLinkId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Calendar Share Links
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate shareable links for your client to view their content calendar
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Generate New Link
        </Button>
      </div>

      {shareLinks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Link2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Share Links Yet</h3>
          <p className="text-muted-foreground mb-4">
            Generate a link to share a calendar view with your client.
          </p>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Generate First Link
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Range</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shareLinks.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <span className="font-medium">
                      {format(parseISO(link.start_date), 'MMM d, yyyy')} – {format(parseISO(link.end_date), 'MMM d, yyyy')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                      {getPublicSiteUrl()}/view/{link.share_id}
                    </code>
                  </TableCell>
                  <TableCell>
                    {link.is_active ? (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(link.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(link.share_id)}
                        title="Copy link"
                      >
                        {copiedId === link.share_id ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`${getPublicSiteUrl()}/view/${link.share_id}`, '_blank')}
                        title="Open link"
                        disabled={!link.is_active}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      {link.is_active && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deactivateShareLink(link.id)}
                          title="Deactivate link"
                        >
                          <XCircle className="w-4 h-4 text-warning" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(link.id)}
                        title="Delete link"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <GenerateShareLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preselectedClientId={clientId}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Share Link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this share link. Anyone with the link will no longer be able to access the calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
