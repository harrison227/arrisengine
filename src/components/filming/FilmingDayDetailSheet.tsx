import { useState } from 'react';
import { format } from 'date-fns';
import { 
  Calendar, Clock, MapPin, Video, Plus, GripVertical, 
  MoreHorizontal, Edit, Trash2, FileText, ChevronDown, ChevronUp 
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilmingDay, useFilmingDays } from '@/hooks/useFilmingDays';
import { useContentPieces, ContentPiece } from '@/hooks/useContentPieces';
import { FilmingDayDialog } from '@/components/dialogs/FilmingDayDialog';
import { ContentPieceDialog } from '@/components/dialogs/ContentPieceDialog';
import { ContentPieceDetailDialog } from '@/components/dialogs/ContentPieceDetailDialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';

interface FilmingDayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filmingDay: FilmingDay;
  clientId: string;
}

const statusColors: Record<string, string> = {
  idea: 'bg-gray-500/10 text-gray-600 border-gray-200',
  scripted: 'bg-blue-500/10 text-blue-600 border-blue-200',
  filmed: 'bg-amber-500/10 text-amber-600 border-amber-200',
  edited: 'bg-purple-500/10 text-purple-600 border-purple-200',
  approved: 'bg-green-500/10 text-green-600 border-green-200',
  live: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
};

const contentTypeIcons: Record<string, string> = {
  video: '🎬',
  image: '📷',
  carousel: '🎠',
  story: '📱',
  reel: '🎞️',
  ugc: '👤',
};

export function FilmingDayDetailSheet({ open, onOpenChange, filmingDay, clientId }: FilmingDayDetailSheetProps) {
  const { updateFilmingDay, deleteFilmingDay } = useFilmingDays(clientId);
  const { pieces, updatePiece, deletePiece } = useContentPieces(undefined, filmingDay.id);
  
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddPieceDialog, setShowAddPieceDialog] = useState(false);
  const [editingPiece, setEditingPiece] = useState<ContentPiece | null>(null);
  const [viewingPiece, setViewingPiece] = useState<ContentPiece | null>(null);
  const [deletingPiece, setDeletingPiece] = useState<ContentPiece | null>(null);
  const [expandedPieces, setExpandedPieces] = useState<Set<string>>(new Set());

  const scriptedCount = pieces.filter(p => p.status !== 'idea').length;
  const progress = pieces.length > 0 ? (scriptedCount / pieces.length) * 100 : 0;

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedPieces);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedPieces(newExpanded);
  };

  const handleStatusChange = (pieceId: string, newStatus: string) => {
    updatePiece({ 
      id: pieceId, 
      status: newStatus as ContentPiece['status'] 
    });
  };

  const handleFilmingDayStatusChange = (newStatus: string) => {
    updateFilmingDay({
      id: filmingDay.id,
      status: newStatus as FilmingDay['status'],
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">Filming Day</SheetTitle>
              <div className="flex items-center gap-2">
                <Select value={filmingDay.status} onValueChange={handleFilmingDayStatusChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Day Info */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(new Date(filmingDay.date), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              {filmingDay.call_time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{filmingDay.call_time} - {filmingDay.wrap_time || 'TBD'}</span>
                </div>
              )}
              {filmingDay.location && (
                <div className="flex items-center gap-2 col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{filmingDay.location}</span>
                </div>
              )}
            </div>
            {filmingDay.equipment_needed && filmingDay.equipment_needed.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-2">Equipment:</p>
                <div className="flex flex-wrap gap-1">
                  {filmingDay.equipment_needed.map((item, i) => (
                    <Badge key={i} variant="secondary">{item}</Badge>
                  ))}
                </div>
              </div>
            )}
            {filmingDay.notes && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                <p className="text-sm">{filmingDay.notes}</p>
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Content Ready</span>
              <span className="text-sm text-muted-foreground">
                {scriptedCount} of {pieces.length} pieces
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <Separator className="my-4" />

          {/* Content Pieces */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Video className="h-4 w-4" />
                Content Pieces ({pieces.length})
              </h3>
              <Button size="sm" onClick={() => setShowAddPieceDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Piece
              </Button>
            </div>

            {pieces.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No content pieces yet</p>
                <p className="text-sm">Add pieces to plan what you'll film</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pieces.map((piece, index) => (
                  <ContentPieceCard
                    key={piece.id}
                    piece={piece}
                    index={index}
                    isExpanded={expandedPieces.has(piece.id)}
                    onToggleExpand={() => toggleExpanded(piece.id)}
                    onStatusChange={(status) => handleStatusChange(piece.id, status)}
                    onEdit={() => setEditingPiece(piece)}
                    onView={() => setViewingPiece(piece)}
                    onDelete={() => setDeletingPiece(piece)}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <FilmingDayDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        clientId={clientId}
        filmingDay={filmingDay}
      />

      <ContentPieceDialog
        open={showAddPieceDialog}
        onOpenChange={setShowAddPieceDialog}
        filmingDayId={filmingDay.id}
        clientId={clientId}
      />

      {editingPiece && (
        <ContentPieceDialog
          open={!!editingPiece}
          onOpenChange={(open) => !open && setEditingPiece(null)}
          filmingDayId={filmingDay.id}
          clientId={clientId}
          piece={editingPiece}
        />
      )}

      {viewingPiece && (
        <ContentPieceDetailDialog
          open={!!viewingPiece}
          onOpenChange={(open) => !open && setViewingPiece(null)}
          piece={viewingPiece}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deletingPiece}
        onOpenChange={(open) => !open && setDeletingPiece(null)}
        onConfirm={() => {
          if (deletingPiece) {
            deletePiece({ id: deletingPiece.id, latePostId: deletingPiece.late_post_id });
            setDeletingPiece(null);
          }
        }}
        title="Delete Content Piece"
        description={`Are you sure you want to delete "${deletingPiece?.concept}"?`}
      />
    </>
  );
}

interface ContentPieceCardProps {
  piece: ContentPiece;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}

function ContentPieceCard({ 
  piece, 
  index, 
  isExpanded, 
  onToggleExpand, 
  onStatusChange,
  onEdit,
  onView,
  onDelete,
}: ContentPieceCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-background">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <span className="text-sm text-muted-foreground w-6">{index + 1}</span>
        <span className="text-lg">{contentTypeIcons[piece.content_type] || '📄'}</span>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{piece.concept}</p>
          {piece.hook && (
            <p className="text-sm text-muted-foreground truncate">"{piece.hook}"</p>
          )}
        </div>

        <Badge variant="outline" className="shrink-0">{piece.platform}</Badge>
        
        <Select value={piece.status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="idea">Idea</SelectItem>
            <SelectItem value="scripted">Scripted</SelectItem>
            <SelectItem value="filmed">Filmed</SelectItem>
            <SelectItem value="edited">Edited</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="live">Live</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" onClick={onToggleExpand}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <FileText className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="p-3 bg-muted/30 border-t space-y-3">
          {piece.script && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Script</p>
              <p className="text-sm whitespace-pre-wrap">{piece.script}</p>
            </div>
          )}
          {piece.shot_notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Shot Notes</p>
              <p className="text-sm">{piece.shot_notes}</p>
            </div>
          )}
          {piece.talent_notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Talent Notes</p>
              <p className="text-sm">{piece.talent_notes}</p>
            </div>
          )}
          {piece.cta && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">CTA</p>
              <p className="text-sm">{piece.cta}</p>
            </div>
          )}
          {piece.b_roll_needed && piece.b_roll_needed.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">B-Roll Needed</p>
              <div className="flex flex-wrap gap-1">
                {piece.b_roll_needed.map((item, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{item}</Badge>
                ))}
              </div>
            </div>
          )}
          {!piece.script && !piece.shot_notes && !piece.talent_notes && !piece.cta && (
            <p className="text-sm text-muted-foreground italic">No details added yet</p>
          )}
        </div>
      )}
    </div>
  );
}
