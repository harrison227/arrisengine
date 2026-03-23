import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ContentPiece } from '@/hooks/useContentPieces';

interface ContentPieceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: ContentPiece;
}

const statusLabels: Record<string, string> = {
  idea: 'Idea',
  scripted: 'Scripted',
  filmed: 'Filmed',
  edited: 'Edited',
  approved: 'Approved',
  live: 'Live',
};

const contentTypeLabels: Record<string, string> = {
  video: '🎬 Video',
  image: '📷 Image',
  carousel: '🎠 Carousel',
  story: '📱 Story',
  reel: '🎞️ Reel',
  ugc: '👤 UGC',
};

export function ContentPieceDetailDialog({ open, onOpenChange, piece }: ContentPieceDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{piece.concept}</span>
            <Badge variant="outline">{statusLabels[piece.status]}</Badge>
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{contentTypeLabels[piece.content_type]}</span>
            <span>•</span>
            <span>{piece.platform}</span>
            {piece.target_duration && (
              <>
                <span>•</span>
                <span>{piece.target_duration}s target</span>
              </>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="concept" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="concept">Concept</TabsTrigger>
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="concept" className="space-y-4 mt-4">
            {piece.hook && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Hook</h4>
                <p className="text-lg font-medium">"{piece.hook}"</p>
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Concept</h4>
              <p>{piece.concept}</p>
            </div>

            {piece.cta && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Call to Action</h4>
                <p>{piece.cta}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="script" className="space-y-4 mt-4">
            {piece.script ? (
              <div className="bg-muted/50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm">{piece.script}</pre>
              </div>
            ) : (
              <p className="text-muted-foreground italic text-center py-8">
                No script written yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="production" className="space-y-4 mt-4">
            {piece.shot_notes && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Shot Notes</h4>
                <p className="text-sm whitespace-pre-wrap">{piece.shot_notes}</p>
              </div>
            )}

            {piece.talent_notes && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Talent Notes</h4>
                <p className="text-sm whitespace-pre-wrap">{piece.talent_notes}</p>
              </div>
            )}

            {piece.b_roll_needed && piece.b_roll_needed.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">B-Roll Checklist</h4>
                <div className="space-y-1">
                  {piece.b_roll_needed.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-4 w-4 border rounded" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!piece.shot_notes && !piece.talent_notes && (!piece.b_roll_needed || piece.b_roll_needed.length === 0) && (
              <p className="text-muted-foreground italic text-center py-8">
                No production notes yet
              </p>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-4">
            {piece.edit_notes ? (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Edit Notes</h4>
                <p className="text-sm whitespace-pre-wrap">{piece.edit_notes}</p>
              </div>
            ) : (
              <p className="text-muted-foreground italic text-center py-8">
                No edit notes yet
              </p>
            )}

            <Separator />

            <div className="text-xs text-muted-foreground">
              <p>Version: {piece.version}</p>
              <p>Created: {new Date(piece.created_at).toLocaleDateString()}</p>
              <p>Updated: {new Date(piece.updated_at).toLocaleDateString()}</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
