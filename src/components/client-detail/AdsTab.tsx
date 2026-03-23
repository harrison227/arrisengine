import { useState } from 'react';
import { Plus, ExternalLink, MoreHorizontal, Pencil, Trash2, Sparkles, Loader2, X, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdLaunches } from '@/hooks/useAdLaunches';
import { useAdSuggestions } from '@/hooks/useAdSuggestions';
import { AddAdLaunchDialog } from '@/components/dialogs/AddAdLaunchDialog';
import { EditAdLaunchDialog } from '@/components/dialogs/EditAdLaunchDialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Database, Tables } from '@/integrations/supabase/types';

type AdStatus = Database['public']['Enums']['ad_status'];
type AdPlatform = Database['public']['Enums']['ad_platform'];
type AdLaunch = Tables<'ad_launches'>;

interface AdsTabProps {
  clientId: string;
  clientName?: string;
  industry?: string;
}

const statusConfig: Record<AdStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Scheduled', className: 'bg-primary/10 text-primary' },
  live: { label: 'Live', className: 'bg-success text-success-foreground' },
  paused: { label: 'Paused', className: 'bg-warning/10 text-warning' },
  completed: { label: 'Completed', className: 'bg-muted text-muted-foreground' },
};

const platformIcons: Record<AdPlatform, string> = {
  meta: '📘',
  google: '🔍',
  tiktok: '🎵',
  linkedin: '💼',
};

const emotionColors: Record<string, string> = {
  curiosity: 'bg-blue-500/10 text-blue-500',
  'fear of missing out': 'bg-orange-500/10 text-orange-500',
  aspiration: 'bg-purple-500/10 text-purple-500',
  trust: 'bg-green-500/10 text-green-500',
  urgency: 'bg-red-500/10 text-red-500',
};

export function AdsTab({ clientId, clientName, industry }: AdsTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AdLaunch | null>(null);
  const [deletingAd, setDeletingAd] = useState<AdLaunch | null>(null);
  const { adLaunches, isLoading, deleteAdLaunch, isDeleting } = useAdLaunches(clientId);
  const { 
    suggestions, 
    isLoading: suggestionsLoading, 
    generateSuggestions, 
    isGenerating,
    deleteSuggestion 
  } = useAdSuggestions(clientId);

  const formatDate = (date?: string | null) => {
    if (!date) return 'Ongoing';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDelete = () => {
    if (deletingAd) {
      deleteAdLaunch(deletingAd.id, {
        onSuccess: () => setDeletingAd(null),
      });
    }
  };

  const getEmotionClass = (emotion: string) => {
    const lowerEmotion = emotion.toLowerCase();
    for (const [key, value] of Object.entries(emotionColors)) {
      if (lowerEmotion.includes(key)) return value;
    }
    return 'bg-primary/10 text-primary';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* AI Suggestions Section */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle>AI Ad Angle Suggestions</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateSuggestions({ clientName, industry })}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {suggestions.length > 0 ? 'Regenerate' : 'Generate'} Suggestions
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            AI-generated ad angles based on the client's knowledge base
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suggestionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion) => (
                <div 
                  key={suggestion.id} 
                  className="relative bg-muted/30 rounded-lg p-4 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <button
                    onClick={() => deleteSuggestion(suggestion.id)}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-start gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <h4 className="font-semibold text-foreground pr-6">{suggestion.hook}</h4>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge className={getEmotionClass(suggestion.target_emotion)}>
                      {suggestion.target_emotion}
                    </Badge>
                    <Badge variant="outline">{suggestion.format}</Badge>
                    <Badge variant="secondary">{suggestion.platform}</Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="mb-2">No suggestions yet</p>
              <p className="text-sm">Click "Generate Suggestions" to get AI-powered ad angles</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ad Launches Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Ad Launches</h3>
          <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            New Launch
          </Button>
        </div>

        <div className="space-y-4">
          {adLaunches.length > 0 ? (
            adLaunches.map((ad) => {
              const status = statusConfig[ad.status];
              return (
                <div key={ad.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xl">{platformIcons[ad.platform]}</span>
                        <h4 className="font-semibold text-foreground">{ad.name}</h4>
                        <Badge className={cn(status.className)}>{status.label}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="capitalize">{ad.campaign_type}</span>
                        <span>•</span>
                        <span>${Number(ad.budget).toLocaleString()} budget</span>
                        <span>•</span>
                        <span>{formatDate(ad.start_date)} - {formatDate(ad.end_date)}</span>
                      </div>

                      {ad.notes && (
                        <p className="text-sm text-muted-foreground mt-3 bg-muted/50 p-3 rounded-lg">
                          {ad.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {ad.ad_account_link && (
                        <a 
                          href={ad.ad_account_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingAd(ad)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Campaign
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => setDeletingAd(ad)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Campaign
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
              <p className="text-muted-foreground mb-4">No ad launches yet</p>
              <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                Create Ad Launch
              </Button>
            </div>
          )}
        </div>
      </div>

      <AddAdLaunchDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
        preselectedClientId={clientId}
      />
      
      {editingAd && (
        <EditAdLaunchDialog
          open={!!editingAd}
          onOpenChange={(open) => !open && setEditingAd(null)}
          adLaunch={editingAd}
        />
      )}
      
      <ConfirmDeleteDialog
        open={!!deletingAd}
        onOpenChange={(open) => !open && setDeletingAd(null)}
        onConfirm={handleDelete}
        title="Delete Ad Campaign"
        description={`Are you sure you want to delete "${deletingAd?.name}"? This action cannot be undone.`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
