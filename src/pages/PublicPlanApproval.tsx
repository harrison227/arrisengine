import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePublicPlanShareLink } from '@/hooks/usePlanShareLinks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Calendar, 
  FileText,
  Loader2,
  AlertCircle,
  Clock,
  Send,
  Lightbulb,
  Ban,
  MapPin,
  Video,
  Clipboard,
  CalendarDays,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ContentIdea {
  hook: string;
  script?: string;
  shotList?: string[];
  audioSuggestion?: string;
  formatType: string;
  platform: string;
  trendingAngle?: string;
  duration?: number;
  category?: string;
}

interface FeedbackState {
  [index: number]: {
    status: 'pending' | 'approved' | 'revision' | 'rejected';
    feedback: string;
  };
}

function parseContentIdeas(brief: string | null): ContentIdea[] {
  if (!brief) return [];
  try {
    const parsed = JSON.parse(brief);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatScriptWithSpacing(script: string): string {
  // Add double line breaks before each script marker for visual separation
  return script
    .replace(/\[HOOK\]/gi, '\n\n[HOOK]')
    .replace(/\[MAIN\]/gi, '\n\n[MAIN]')
    .replace(/\[CTA\]/gi, '\n\n[CTA]')
    .replace(/\[TEXT:/gi, '\n\n[TEXT:')
    .trim();
}

export default function PublicPlanApproval() {
  const { shareId } = useParams<{ shareId: string }>();
  const { data: shareLink, isLoading, error } = usePublicPlanShareLink(shareId);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>({});
  const [activeComment, setActiveComment] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilmingChangeForm, setShowFilmingChangeForm] = useState(false);
  const [filmingChangeDate, setFilmingChangeDate] = useState<Date | undefined>();
  const [filmingChangeTime, setFilmingChangeTime] = useState('');
  const [filmingChangeNotes, setFilmingChangeNotes] = useState('');
  const [isSubmittingFilmingChange, setIsSubmittingFilmingChange] = useState(false);
  const [filmingDayConfirmed, setFilmingDayConfirmed] = useState(false);
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading plan...</p>
        </div>
      </div>
    );
  }

  if (error || !shareLink) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Link Not Found</h2>
            <p className="text-muted-foreground">
              This approval link may have expired or been deactivated. Please contact your content team for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = shareLink.content_plans;
  const client = plan?.clients;
  const ideas = parseContentIdeas(plan?.brief || null);
  const clientName = shareLink.client_name;
  const filmingDay = shareLink.filming_day;
  const strategyNotes = plan?.strategy_notes;

  const handleApprove = (index: number) => {
    const currentStatus = feedbackState[index]?.status;
    
    if (currentStatus === 'approved') {
      // Toggle off - clear the selection
      setFeedbackState(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
      toast({ title: 'Selection cleared', description: 'You can make a new choice.' });
    } else {
      // Set as approved
      setFeedbackState(prev => ({
        ...prev,
        [index]: { status: 'approved', feedback: prev[index]?.feedback || '' }
      }));
      toast({ title: 'Content approved', description: `Item ${index + 1} marked as approved.` });
    }
  };

  const handleRequestRevision = (index: number) => {
    const currentStatus = feedbackState[index]?.status;
    
    if (currentStatus === 'revision') {
      // Toggle off - clear the selection
      setFeedbackState(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
      setActiveComment(null);
      setCommentText('');
      toast({ title: 'Selection cleared', description: 'You can make a new choice.' });
    } else {
      // Set as revision
      setActiveComment(index);
      setFeedbackState(prev => ({
        ...prev,
        [index]: { status: 'revision', feedback: prev[index]?.feedback || '' }
      }));
    }
  };

  const handleReject = (index: number) => {
    const currentStatus = feedbackState[index]?.status;
    
    if (currentStatus === 'rejected') {
      // Toggle off - clear the selection
      setFeedbackState(prev => {
        const newState = { ...prev };
        delete newState[index];
        return newState;
      });
      toast({ title: 'Selection cleared', description: 'You can make a new choice.' });
    } else {
      // Set as rejected
      setFeedbackState(prev => ({
        ...prev,
        [index]: { status: 'rejected', feedback: prev[index]?.feedback || '' }
      }));
      toast({ title: 'Content rejected', description: `Item ${index + 1} marked as rejected.` });
    }
  };

  const handleSubmitFeedback = (index: number) => {
    if (commentText.trim()) {
      setFeedbackState(prev => ({
        ...prev,
        [index]: { status: 'revision', feedback: commentText }
      }));
      toast({ title: 'Feedback submitted', description: 'Your revision request has been noted.' });
    }
    setActiveComment(null);
    setCommentText('');
  };

  const handleSubmitAll = async () => {
    setIsSubmitting(true);
    
    try {
      // Prepare feedback items to insert
      const feedbackItems = Object.entries(feedbackState).map(([indexStr, feedback]) => {
        const index = parseInt(indexStr, 10);
        const idea = ideas[index];
        return {
          share_link_id: shareLink.id,
          content_plan_id: plan?.id,
          idea_index: index,
          idea_title: idea?.hook || `Idea ${index + 1}`,
          status: feedback.status === 'pending' ? 'approved' : feedback.status,
          feedback_text: feedback.feedback || null,
          submitted_by_name: clientName || null,
        };
      });

      // Also include items not explicitly interacted with as "approved" (pending means no action taken)
      ideas.forEach((idea, index) => {
        if (!feedbackState[index]) {
          feedbackItems.push({
            share_link_id: shareLink.id,
            content_plan_id: plan?.id,
            idea_index: index,
            idea_title: idea?.hook || `Idea ${index + 1}`,
            status: 'approved', // Default to approved if no action taken
            feedback_text: null,
            submitted_by_name: clientName || null,
          });
        }
      });

      // Insert all feedback items
      if (feedbackItems.length > 0) {
        const { error: insertError } = await supabase
          .from('plan_feedback')
          .insert(feedbackItems);
        
        if (insertError) throw insertError;
      }

      // Update share link with feedback submission timestamp
      const { error: updateError } = await supabase
        .from('plan_share_links')
        .update({ feedback_submitted_at: new Date().toISOString() })
        .eq('id', shareLink.id);

      if (updateError) throw updateError;

      toast({
        title: 'Review submitted!',
        description: 'Your feedback has been sent to the content team.',
      });
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Failed to submit feedback',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getApprovalStats = () => {
    const approved = Object.values(feedbackState).filter(f => f.status === 'approved').length;
    const revision = Object.values(feedbackState).filter(f => f.status === 'revision').length;
    const rejected = Object.values(feedbackState).filter(f => f.status === 'rejected').length;
    const pending = ideas.length - approved - revision - rejected;
    return { approved, revision, rejected, pending };
  };

  const stats = getApprovalStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {client?.brand_logo_url && (
                <img 
                  src={client.brand_logo_url} 
                  alt={client.business_name} 
                  className="h-10 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Content Plan Review
                </h1>
                {clientName && (
                  <p className="text-sm text-muted-foreground">
                    Prepared for {clientName}
                  </p>
                )}
              </div>
            </div>
            {client && (
              <Badge 
                variant="outline" 
                style={{ 
                  borderColor: client.brand_primary_color || undefined,
                  color: client.brand_primary_color || undefined 
                }}
              >
                {client.business_name}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Plan Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {plan?.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {plan?.filming_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Filming: {format(new Date(plan.filming_date), 'MMMM d, yyyy')}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{ideas.length} content pieces</span>
              </div>
            </div>

            {/* Progress Stats */}
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{stats.approved} approved</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="w-4 h-4 text-orange-500" />
                <span>{stats.revision} need revision</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Ban className="w-4 h-4 text-destructive" />
                <span>{stats.rejected} rejected</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span>{stats.pending} pending</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strategy & Context Section */}
        {(strategyNotes || filmingDay) && (
          <div className="space-y-4">
            {/* Strategy Notes */}
            {strategyNotes && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Lightbulb className="w-5 h-5 text-primary" />
                    Our Strategy & Thought Process
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {strategyNotes}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Filming Day Recommendation */}
            {filmingDay && (
              <Card className={filmingDayConfirmed ? 'border-green-500/50 bg-green-500/5' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Video className="w-5 h-5 text-primary" />
                      Filming Day Details
                    </CardTitle>
                    {filmingDayConfirmed && (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Confirmed
                      </Badge>
                    )}
                    {filmingDay.client_change_requested && (
                      <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                        <Edit className="w-3 h-3 mr-1" />
                        Change Requested
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Date */}
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">Suggested Date: </span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(filmingDay.date), 'EEEE, MMMM d, yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  {filmingDay.location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium">Location: </span>
                        <span className="text-sm text-muted-foreground">{filmingDay.location}</span>
                      </div>
                    </div>
                  )}

                  {/* Call & Wrap Times */}
                  {(filmingDay.call_time || filmingDay.wrap_time) && (
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        {filmingDay.call_time && (
                          <>
                            <span className="text-sm font-medium">Call Time: </span>
                            <span className="text-sm text-muted-foreground">{filmingDay.call_time}</span>
                          </>
                        )}
                        {filmingDay.call_time && filmingDay.wrap_time && (
                          <span className="text-sm text-muted-foreground"> — </span>
                        )}
                        {filmingDay.wrap_time && (
                          <>
                            <span className="text-sm font-medium">Wrap: </span>
                            <span className="text-sm text-muted-foreground">{filmingDay.wrap_time}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {filmingDay.notes && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clipboard className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Notes</h4>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg ml-6">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {filmingDay.notes}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Equipment Needed */}
                  {filmingDay.equipment_needed && filmingDay.equipment_needed.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium">Equipment Needed</h4>
                      </div>
                      <ul className="list-disc list-inside text-sm text-muted-foreground ml-6 space-y-1">
                        {filmingDay.equipment_needed.map((item: string, i: number) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Separator />

                  {/* Action Buttons or Change Form */}
                  {!showFilmingChangeForm && !filmingDayConfirmed && !filmingDay.client_change_requested ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setFilmingDayConfirmed(true);
                          toast({ 
                            title: 'Date Confirmed', 
                            description: 'You have confirmed the filming date.' 
                          });
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirm This Date
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowFilmingChangeForm(true)}
                      >
                        <CalendarDays className="w-4 h-4 mr-2" />
                        Request Changes
                      </Button>
                    </div>
                  ) : showFilmingChangeForm ? (
                    <div className="space-y-4 pt-2 border-t">
                      <h4 className="text-sm font-medium">Request Date/Time Change</h4>
                      
                      <div className="space-y-2">
                        <Label htmlFor="preferred-date">Preferred Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !filmingChangeDate && "text-muted-foreground"
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {filmingChangeDate ? format(filmingChangeDate, 'PPP') : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={filmingChangeDate}
                              onSelect={setFilmingChangeDate}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                              disabled={(date) => date < new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="preferred-time">Preferred Time (optional)</Label>
                        <Input
                          id="preferred-time"
                          placeholder="e.g., Morning preferred, After 2pm"
                          value={filmingChangeTime}
                          onChange={(e) => setFilmingChangeTime(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="change-notes">Notes (optional)</Label>
                        <Textarea
                          id="change-notes"
                          placeholder="Please share any scheduling constraints or preferences..."
                          value={filmingChangeNotes}
                          onChange={(e) => setFilmingChangeNotes(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={isSubmittingFilmingChange}
                          onClick={async () => {
                            setIsSubmittingFilmingChange(true);
                            try {
                              const { error } = await supabase
                                .from('filming_days')
                                .update({
                                  client_change_requested: true,
                                  client_requested_date: filmingChangeDate ? format(filmingChangeDate, 'yyyy-MM-dd') : null,
                                  client_requested_time: filmingChangeTime || null,
                                  client_change_notes: filmingChangeNotes || null,
                                  client_change_requested_at: new Date().toISOString(),
                                })
                                .eq('id', filmingDay.id);

                              if (error) throw error;

                              toast({
                                title: 'Request Submitted',
                                description: 'Your change request has been sent to the content team.',
                              });
                              setShowFilmingChangeForm(false);
                              // Update local state to reflect change
                              filmingDay.client_change_requested = true;
                            } catch (err) {
                              toast({
                                title: 'Error',
                                description: 'Failed to submit change request. Please try again.',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsSubmittingFilmingChange(false);
                            }
                          }}
                        >
                          {isSubmittingFilmingChange ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Submit Request
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowFilmingChangeForm(false);
                            setFilmingChangeDate(undefined);
                            setFilmingChangeTime('');
                            setFilmingChangeNotes('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : filmingDay.client_change_requested ? (
                    <div className="bg-orange-500/10 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-600">Change Request Submitted</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your request has been sent to the content team. They will follow up with you shortly.
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Content Ideas */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Content Pieces</h2>
          
          {(() => {
            const categories = [...new Set(ideas.map(i => i.category || 'Uncategorised'))];
            const hasCategories = categories.length > 1 || (categories.length === 1 && categories[0] !== 'Uncategorised');

            const renderIdeaCard = (idea: ContentIdea, index: number) => {
              const feedback = feedbackState[index];
              const isApproved = feedback?.status === 'approved';
              const needsRevision = feedback?.status === 'revision';
              const isRejected = feedback?.status === 'rejected';
              
              return (
                <Card 
                  key={index}
                  className={`transition-all ${
                    isApproved ? 'border-green-500/50 bg-green-500/5' : 
                    needsRevision ? 'border-orange-500/50 bg-orange-500/5' : 
                    isRejected ? 'border-destructive/50 bg-destructive/5' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            #{index + 1}
                          </span>
                          <Badge variant="outline">{idea.platform}</Badge>
                          <Badge variant="secondary">{idea.formatType}</Badge>
                          {idea.duration && (
                            <Badge variant="outline">{idea.duration}s</Badge>
                          )}
                        </div>
                        <CardTitle className="text-base">{idea.hook}</CardTitle>
                      </div>
                      {isApproved && (
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      )}
                      {needsRevision && (
                        <Badge variant="destructive" className="bg-orange-500 hover:bg-orange-600">
                          <XCircle className="w-3 h-3 mr-1" />
                          Revision Requested
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge variant="destructive">
                          <Ban className="w-3 h-3 mr-1" />
                          Rejected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {idea.script && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Script</h4>
                        <div className="bg-muted/50 p-4 rounded-lg">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{formatScriptWithSpacing(idea.script)}</p>
                        </div>
                      </div>
                    )}
                    {idea.shotList && idea.shotList.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Shot List</h4>
                        <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                          {idea.shotList.map((shot, i) => (
                            <li key={i}>{shot}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {idea.audioSuggestion && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Audio Suggestion</h4>
                        <p className="text-sm text-muted-foreground">{idea.audioSuggestion}</p>
                      </div>
                    )}
                    {idea.trendingAngle && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Trending Angle</h4>
                        <p className="text-sm text-muted-foreground">{idea.trendingAngle}</p>
                      </div>
                    )}
                    <Separator />
                    {feedback?.feedback && needsRevision && (
                      <div className="bg-orange-500/10 p-3 rounded-lg">
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1">Your feedback:</p>
                        <p className="text-sm">{feedback.feedback}</p>
                      </div>
                    )}
                    {activeComment === index && (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Describe what changes you'd like to see..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSubmitFeedback(index)} disabled={!commentText.trim()}>
                            <Send className="w-4 h-4 mr-2" />
                            Submit Feedback
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setActiveComment(null); setCommentText(''); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {activeComment !== index && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant={isApproved ? 'secondary' : 'default'} onClick={() => handleApprove(index)}
                          className={isApproved ? 'bg-green-500/20 text-green-600 hover:bg-green-500/30' : ''}>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          {isApproved ? 'Click to Undo' : 'Approve'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRequestRevision(index)}
                          className={needsRevision ? 'border-orange-500 text-orange-500' : ''}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          {needsRevision ? 'Click to Undo' : 'Request Revisions'}
                        </Button>
                        <Button size="sm" variant={isRejected ? 'secondary' : 'outline'} onClick={() => handleReject(index)}
                          className={isRejected ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' : 'text-destructive border-destructive/50 hover:bg-destructive/10'}>
                          <Ban className="w-4 h-4 mr-2" />
                          {isRejected ? 'Click to Undo' : 'Reject'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            };

            if (!hasCategories) {
              return ideas.map((idea, index) => renderIdeaCard(idea, index));
            }

            return categories.map(cat => {
              const catIdeas = ideas
                .map((idea, index) => ({ idea, index }))
                .filter(({ idea }) => (idea.category || 'Uncategorised') === cat);

              return (
                <div key={cat} className="space-y-4">
                  <div className="flex items-center gap-3 pt-4">
                    <h3 className="text-base font-bold text-foreground">{cat}</h3>
                    <Badge variant="outline" className="text-xs">{catIdeas.length}</Badge>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {catIdeas.map(({ idea, index }) => renderIdeaCard(idea, index))}
                </div>
              );
            });
          })()}
        </div>

        {/* Submit All Button */}
        {ideas.length > 0 && (
          <div className="sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border border-border shadow-lg">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {stats.approved + stats.revision + stats.rejected} of {ideas.length} items reviewed
              </div>
              <Button
                onClick={handleSubmitAll}
                disabled={isSubmitting || (stats.approved + stats.revision + stats.rejected) === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Review
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Powered by your content team
        </div>
      </footer>
    </div>
  );
}
