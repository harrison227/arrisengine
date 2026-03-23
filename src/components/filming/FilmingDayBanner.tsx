import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Calendar, Clock, MapPin, Users, Video, ChevronRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useFilmingDays, FilmingDay } from '@/hooks/useFilmingDays';
import { useContentPieces } from '@/hooks/useContentPieces';
import { FilmingDayDialog } from '@/components/dialogs/FilmingDayDialog';
import { FilmingDayDetailSheet } from '@/components/filming/FilmingDayDetailSheet';

interface FilmingDayBannerProps {
  clientId: string;
}

export function FilmingDayBanner({ clientId }: FilmingDayBannerProps) {
  const { filmingDays, activeFilmingDay, isLoading } = useFilmingDays(clientId);
  const [showDialog, setShowDialog] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!activeFilmingDay) {
    return (
      <>
        <Card className="border-dashed border-2 border-muted-foreground/25">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Video className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">No Filming Day Scheduled</h3>
                  <p className="text-muted-foreground text-sm">
                    Schedule a filming day to start planning content
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Filming Day
              </Button>
            </div>
          </CardContent>
        </Card>
        <FilmingDayDialog 
          open={showDialog} 
          onOpenChange={setShowDialog} 
          clientId={clientId} 
        />
      </>
    );
  }

  return (
    <>
      <FilmingDayCard 
        filmingDay={activeFilmingDay} 
        onClick={() => setShowDetail(true)} 
      />
      <FilmingDayDialog 
        open={showDialog} 
        onOpenChange={setShowDialog} 
        clientId={clientId} 
      />
      <FilmingDayDetailSheet
        open={showDetail}
        onOpenChange={setShowDetail}
        filmingDay={activeFilmingDay}
        clientId={clientId}
      />
    </>
  );
}

interface FilmingDayCardProps {
  filmingDay: FilmingDay;
  onClick: () => void;
}

function FilmingDayCard({ filmingDay, onClick }: FilmingDayCardProps) {
  const { pieces } = useContentPieces(undefined, filmingDay.id);
  
  const daysUntil = differenceInDays(new Date(filmingDay.date), new Date());
  const scriptedCount = pieces.filter(p => p.status !== 'idea').length;
  const progress = pieces.length > 0 ? (scriptedCount / pieces.length) * 100 : 0;

  const statusColors = {
    upcoming: 'bg-blue-500/10 text-blue-600 border-blue-200',
    in_progress: 'bg-amber-500/10 text-amber-600 border-amber-200',
    completed: 'bg-green-500/10 text-green-600 border-green-200',
  };

  return (
    <Card 
      className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 rounded-xl bg-primary/20 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {format(new Date(filmingDay.date), 'd')}
              </span>
              <span className="text-xs text-primary uppercase">
                {format(new Date(filmingDay.date), 'MMM')}
              </span>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg">Filming Day</h3>
                <Badge className={statusColors[filmingDay.status]}>
                  {filmingDay.status === 'in_progress' ? 'In Progress' : 
                   filmingDay.status.charAt(0).toUpperCase() + filmingDay.status.slice(1)}
                </Badge>
                {daysUntil >= 0 && filmingDay.status === 'upcoming' && (
                  <Badge variant="outline">
                    {daysUntil === 0 ? 'Today!' : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} away`}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(filmingDay.date), 'EEEE, MMMM d, yyyy')}
                </span>
                {filmingDay.call_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {filmingDay.call_time}
                  </span>
                )}
                {filmingDay.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {filmingDay.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Video className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{pieces.length} pieces</span>
              </div>
              <div className="w-32">
                <Progress value={progress} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {scriptedCount} of {pieces.length} ready
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
