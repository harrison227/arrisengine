import React from 'react';
import { usePlanFeedback, FeedbackGroup } from '@/hooks/usePlanFeedback';
import { useFilmingDayChangeRequests, FilmingDayChangeRequest } from '@/hooks/useFilmingDayFeedback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp,
  User,
  Calendar,
  Ban,
  Inbox,
  Video,
  Clock,
  FileText,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface PlanFeedbackSectionProps {
  contentPlanId: string;
  clientId?: string;
}

function FeedbackGroupCard({ group }: { group: FeedbackGroup }) {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <Card className="border-border">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{group.shareLink.client_name || 'Anonymous'}</span>
                {group.shareLink.feedback_submitted_at && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(group.shareLink.feedback_submitted_at), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {/* Stats badges */}
                <div className="flex items-center gap-2">
                  {group.stats.approved > 0 && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {group.stats.approved}
                    </Badge>
                  )}
                  {group.stats.revision > 0 && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                      <XCircle className="w-3 h-3 mr-1" />
                      {group.stats.revision}
                    </Badge>
                  )}
                  {group.stats.rejected > 0 && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                      <Ban className="w-3 h-3 mr-1" />
                      {group.stats.rejected}
                    </Badge>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-2">
            {group.items.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  item.status === 'approved' && "bg-green-500/5 border-green-500/20",
                  item.status === 'revision' && "bg-orange-500/5 border-orange-500/20",
                  item.status === 'rejected' && "bg-destructive/5 border-destructive/20"
                )}
              >
                <div className="mt-0.5">
                  {item.status === 'approved' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                  {item.status === 'revision' && (
                    <XCircle className="w-5 h-5 text-orange-600" />
                  )}
                  {item.status === 'rejected' && (
                    <Ban className="w-5 h-5 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{item.idea_index + 1}</span>
                    <span className="text-sm font-medium truncate">{item.idea_title}</span>
                  </div>
                  {item.feedback_text && (
                    <div className="mt-2 flex items-start gap-2">
                      <MessageSquare className="w-3 h-3 mt-1 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">{item.feedback_text}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function FilmingDayChangeRequestCard({ request, clientId }: { request: FilmingDayChangeRequest; clientId: string }) {
  const navigate = useNavigate();
  
  return (
    <Alert className="border-orange-500/30 bg-orange-500/5">
      <Video className="h-4 w-4 text-orange-600" />
      <AlertTitle className="flex items-center justify-between">
        <span className="text-orange-600">Filming Day Change Requested</span>
        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
          Pending
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">
          The client has requested to reschedule the filming day:
        </p>
        
        <div className="space-y-2 text-sm">
          {request.client_requested_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Requested Date:</span>
              <span>{format(new Date(request.client_requested_date), 'MMMM d, yyyy')}</span>
            </div>
          )}
          
          {request.client_requested_time && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Preferred Time:</span>
              <span>{request.client_requested_time}</span>
            </div>
          )}
          
          {request.client_change_notes && (
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="font-medium">Notes:</span>
                <p className="text-muted-foreground mt-1">"{request.client_change_notes}"</p>
              </div>
            </div>
          )}
        </div>
        
        {request.client_change_requested_at && (
          <p className="text-xs text-muted-foreground">
            Requested on: {format(new Date(request.client_change_requested_at), 'MMM d, yyyy \'at\' h:mm a')}
          </p>
        )}
        
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate(`/clients/${clientId}?tab=filming`)}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View Filming Day Tab
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export function PlanFeedbackSection({ contentPlanId, clientId }: PlanFeedbackSectionProps) {
  const { data: feedbackGroups, isLoading } = usePlanFeedback(contentPlanId);
  const { data: filmingDayRequests, isLoading: isLoadingFilmingRequests } = useFilmingDayChangeRequests(clientId);
  const [isExpanded, setIsExpanded] = React.useState(true);

  const isAnyLoading = isLoading || isLoadingFilmingRequests;

  if (isAnyLoading) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Inbox className="w-4 h-4 text-primary" />
            Client Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading feedback...</p>
        </CardContent>
      </Card>
    );
  }

  const hasFeedback = feedbackGroups && feedbackGroups.length > 0;
  const hasFilmingRequests = filmingDayRequests && filmingDayRequests.length > 0;
  const totalResponses = (feedbackGroups?.length || 0) + (filmingDayRequests?.length || 0);

  return (
    <Card className="border-primary/20">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-primary" />
                Client Feedback
                {totalResponses > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {totalResponses} {totalResponses === 1 ? 'response' : 'responses'}
                  </Badge>
                )}
                {hasFilmingRequests && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30">
                    Filming Change
                  </Badge>
                )}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Filming Day Change Requests - Show at top */}
            {hasFilmingRequests && clientId && filmingDayRequests.map((request) => (
              <FilmingDayChangeRequestCard 
                key={request.id} 
                request={request} 
                clientId={clientId} 
              />
            ))}
            
            {/* Content Idea Feedback */}
            {!hasFeedback && !hasFilmingRequests ? (
              <div className="text-center py-6 text-muted-foreground">
                <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No feedback received yet</p>
                <p className="text-xs mt-1">Share the plan link to collect client feedback</p>
              </div>
            ) : hasFeedback ? (
              feedbackGroups.map((group) => (
                <FeedbackGroupCard key={group.shareLink.id} group={group} />
              ))
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
