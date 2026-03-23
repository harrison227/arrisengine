import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Calendar, Clock, MapPin, Video, Plus, Settings, CheckCircle, AlertCircle, Trash2, MessageSquare, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFilmingDays, FilmingDay } from '@/hooks/useFilmingDays';
import { useContentPieces } from '@/hooks/useContentPieces';
import { FilmingDayDialog } from '@/components/dialogs/FilmingDayDialog';
import { FilmingDayDetailSheet } from '@/components/filming/FilmingDayDetailSheet';
import { ContentPieceDialog } from '@/components/dialogs/ContentPieceDialog';
import { useContentPlans } from '@/hooks/useContentPlans';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';

interface FilmingDayTabProps {
  clientId: string;
}

export function FilmingDayTab({ clientId }: FilmingDayTabProps) {
  const { filmingDays, activeFilmingDay, isLoading, deleteFilmingDay, isDeleting, updateFilmingDay } = useFilmingDays(clientId);
  const { contentPlans } = useContentPlans(clientId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [showAddPieceDialog, setShowAddPieceDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDismissChangeRequest = (filmingDayId: string) => {
    updateFilmingDay({
      id: filmingDayId,
      client_change_requested: false,
      client_requested_date: null,
      client_requested_time: null,
      client_change_notes: null,
      client_change_requested_at: null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-40 bg-muted rounded-xl" />
        <div className="animate-pulse h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  // No filming day scheduled
  if (!activeFilmingDay) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <Video className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Filming Day Scheduled</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Schedule your client's filming day to start planning content pieces, scripts, and shot lists.
            </p>
            <Button size="lg" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Schedule Filming Day
            </Button>
          </CardContent>
        </Card>

        {/* Past filming days */}
        {filmingDays.filter(d => d.status === 'completed').length > 0 && (
          <div>
            <h3 className="font-semibold mb-3">Past Filming Days</h3>
            <div className="space-y-2">
              {filmingDays.filter(d => d.status === 'completed').map(day => (
                <PastFilmingDayCard key={day.id} filmingDay={day} clientId={clientId} />
              ))}
            </div>
          </div>
        )}

        <FilmingDayDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          clientId={clientId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Change Request Alert */}
      {activeFilmingDay?.client_change_requested && (
        <Alert variant="default" className="border-orange-500/50 bg-orange-500/10">
          <MessageSquare className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-600">Client Change Request</AlertTitle>
          <AlertDescription className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The client has requested changes to this filming day.
            </p>
            <div className="space-y-2 text-sm">
              {activeFilmingDay.client_requested_date && (
                <div>
                  <span className="font-medium">Requested Date: </span>
                  <span className="text-muted-foreground">
                    {format(new Date(activeFilmingDay.client_requested_date), 'MMMM d, yyyy')}
                  </span>
                </div>
              )}
              {activeFilmingDay.client_requested_time && (
                <div>
                  <span className="font-medium">Preferred Time: </span>
                  <span className="text-muted-foreground">{activeFilmingDay.client_requested_time}</span>
                </div>
              )}
              {activeFilmingDay.client_change_notes && (
                <div>
                  <span className="font-medium">Notes: </span>
                  <span className="text-muted-foreground">"{activeFilmingDay.client_change_notes}"</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowEditDialog(true);
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Update Filming Day
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDismissChangeRequest(activeFilmingDay.id)}
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Active Filming Day */}
      <ActiveFilmingDayCard
        filmingDay={activeFilmingDay}
        clientId={clientId}
        onEdit={() => setShowEditDialog(true)}
        onViewDetail={() => setShowDetailSheet(true)}
        onAddPiece={() => setShowAddPieceDialog(true)}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      {/* Past filming days */}
      {filmingDays.filter(d => d.status === 'completed').length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Past Filming Days</h3>
          <div className="space-y-2">
            {filmingDays.filter(d => d.status === 'completed').map(day => (
              <PastFilmingDayCard key={day.id} filmingDay={day} clientId={clientId} />
            ))}
          </div>
        </div>
      )}

      <FilmingDayDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        clientId={clientId}
        filmingDay={activeFilmingDay}
      />

      <FilmingDayDetailSheet
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        filmingDay={activeFilmingDay}
        clientId={clientId}
      />

      {contentPlans[0] && (
        <ContentPieceDialog
          open={showAddPieceDialog}
          onOpenChange={setShowAddPieceDialog}
          filmingDayId={activeFilmingDay.id}
          clientId={clientId}
        />
      )}

      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Filming Day"
        description="Are you sure you want to delete this filming day? This will also remove all associated content pieces. This action cannot be undone."
        onConfirm={() => {
          deleteFilmingDay(activeFilmingDay.id);
          setShowDeleteConfirm(false);
        }}
        isDeleting={isDeleting}
      />
    </div>
  );
}

interface ActiveFilmingDayCardProps {
  filmingDay: FilmingDay;
  clientId: string;
  onEdit: () => void;
  onViewDetail: () => void;
  onAddPiece: () => void;
  onDelete: () => void;
}

function ActiveFilmingDayCard({ filmingDay, clientId, onEdit, onViewDetail, onAddPiece, onDelete }: ActiveFilmingDayCardProps) {
  const { pieces } = useContentPieces(undefined, filmingDay.id);
  
  const daysUntil = differenceInDays(new Date(filmingDay.date), new Date());
  const scriptedCount = pieces.filter(p => p.status !== 'idea').length;
  const progress = pieces.length > 0 ? (scriptedCount / pieces.length) * 100 : 0;
  const needsScripts = pieces.filter(p => p.status === 'idea').length;

  const statusColors = {
    upcoming: 'bg-blue-500/10 text-blue-600',
    in_progress: 'bg-amber-500/10 text-amber-600',
    completed: 'bg-green-500/10 text-green-600',
  };

  return (
    <Card className="border-primary/20 overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl bg-primary/20 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-primary">
                {format(new Date(filmingDay.date), 'd')}
              </span>
              <span className="text-sm text-primary uppercase font-medium">
                {format(new Date(filmingDay.date), 'MMM')}
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">Filming Day</h2>
                <Badge className={statusColors[filmingDay.status]}>
                  {filmingDay.status === 'in_progress' ? 'In Progress' : 
                   filmingDay.status.charAt(0).toUpperCase() + filmingDay.status.slice(1)}
                </Badge>
              </div>
              
              <p className="text-lg text-muted-foreground">
                {format(new Date(filmingDay.date), 'EEEE, MMMM d, yyyy')}
              </p>
              
              {daysUntil >= 0 && filmingDay.status === 'upcoming' && (
                <p className="text-sm font-medium text-primary mt-1">
                  {daysUntil === 0 ? "🎬 Today's the day!" : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} away`}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Settings className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          {filmingDay.call_time && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{filmingDay.call_time} - {filmingDay.wrap_time || 'TBD'}</span>
            </div>
          )}
          {filmingDay.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{filmingDay.location}</span>
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Video className="h-4 w-4" />
              Content Pieces
            </h3>
            <p className="text-sm text-muted-foreground">
              {pieces.length} pieces planned for this shoot
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onAddPiece}>
              <Plus className="h-4 w-4 mr-1" />
              Add Piece
            </Button>
            <Button size="sm" onClick={onViewDetail}>
              View All
            </Button>
          </div>
        </div>

        {pieces.length > 0 ? (
          <>
            <div className="flex items-center gap-4 mb-4">
              <Progress value={progress} className="flex-1 h-3" />
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">{scriptedCount} Ready</p>
                  <p className="text-xs text-muted-foreground">Scripted or further</p>
                </div>
              </div>
              
              {needsScripts > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <div>
                    <p className="font-medium">{needsScripts} Need Scripts</p>
                    <p className="text-xs text-muted-foreground">Still in idea stage</p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No content pieces added yet</p>
            <Button variant="link" onClick={onAddPiece}>Add your first piece</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface PastFilmingDayCardProps {
  filmingDay: FilmingDay;
  clientId: string;
}

function PastFilmingDayCard({ filmingDay, clientId }: PastFilmingDayCardProps) {
  const { pieces } = useContentPieces(undefined, filmingDay.id);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <Card 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setShowDetail(true)}
      >
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{format(new Date(filmingDay.date), 'MMMM d, yyyy')}</p>
              <p className="text-sm text-muted-foreground">
                {pieces.length} pieces • {filmingDay.location || 'No location set'}
              </p>
            </div>
          </div>
          <Badge variant="secondary">Completed</Badge>
        </CardContent>
      </Card>

      <FilmingDayDetailSheet
        open={showDetail}
        onOpenChange={setShowDetail}
        filmingDay={filmingDay}
        clientId={clientId}
      />
    </>
  );
}
