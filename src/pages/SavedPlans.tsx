import React, { useState } from 'react';
import { useContentPlans } from '@/hooks/useContentPlans';
import { useClients } from '@/hooks/useClients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SavedPlanDetail } from '@/components/plans/SavedPlanDetail';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { GeneratePlanShareLinkDialog } from '@/components/dialogs/GeneratePlanShareLinkDialog';
import { PasteScriptsDialog } from '@/components/dialogs/PasteScriptsDialog';
import { 
  FolderOpen, 
  Search, 
  Calendar, 
  FileText, 
  Trash2, 
  Eye,
  Sparkles,
  Share2,
  Copy,
  Plus,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type ContentPlan = Tables<'content_plans'>;

interface ContentIdea {
  hook: string;
  script?: string;
  shotList?: string[];
  audioSuggestion?: string;
  formatType: string;
  platform: string | string[];
  trendingAngle?: string;
  duration?: number;
  category?: string;
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

export default function SavedPlans() {
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<ContentPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<ContentPlan | null>(null);
  const [planToShare, setPlanToShare] = useState<ContentPlan | null>(null);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  
  const { contentPlans, isLoading, deleteContentPlan, isDeleting, duplicateContentPlan, isDuplicating, savePlan, isSaving } = useContentPlans();
  const { clients } = useClients();
  const { toast } = useToast();

  // Filter plans
  const filteredPlans = contentPlans.filter(plan => {
    const matchesClient = clientFilter === 'all' || plan.client_id === clientFilter;
    const matchesSearch = !searchQuery || 
      plan.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClient && matchesSearch;
  });

  // Get client name by ID
  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.business_name || 'Unknown Client';
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'complete': return 'default';
      case 'filming': return 'secondary';
      case 'editing': return 'outline';
      case 'scheduled': return 'outline';
      default: return 'secondary';
    }
  };

  const handleDeleteConfirm = () => {
    if (planToDelete) {
      deleteContentPlan(planToDelete.id);
      setPlanToDelete(null);
    }
  };

  const handlePasteScriptsSave = async ({ clientId, title, scripts }: {
    clientId: string;
    title: string;
    scripts: { category: string; hook: string; script: string }[];
  }) => {
    const contentIdeas = scripts.map(s => ({
      hook: s.hook,
      script: s.script,
      formatType: 'Script',
      platform: 'Instagram',
      category: s.category,
    }));
    try {
      await savePlan({ clientId, title, contentIdeas: contentIdeas as any });
      setShowPasteDialog(false);
      toast({ title: 'Plan created!', description: `${scripts.length} scripts saved across ${[...new Set(scripts.map(s => s.category))].length} categories.` });
    } catch (error) {
      // error toast handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Saved Plans</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-5 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" />
            Saved Plans
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredPlans.length} plan{filteredPlans.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button onClick={() => setShowPasteDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Plan
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                {client.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plans Grid */}
      {filteredPlans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No saved plans yet</h3>
          <p className="text-muted-foreground max-w-sm">
            Create content plans using the Content Planner and save them here for future reference.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map(plan => {
            const ideas = parseContentIdeas(plan.brief);
            const platforms = [...new Set(ideas.flatMap(i => 
              Array.isArray(i.platform) ? i.platform : [i.platform]
            ))];
            const categories = [...new Set(ideas.map(i => (i as any).category).filter(Boolean))];
            
            return (
              <Card 
                key={plan.id} 
                className="group hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedPlan(plan)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold line-clamp-2">
                      {plan.title}
                    </CardTitle>
                    <Badge variant={getStatusVariant(plan.status)}>
                      {plan.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {getClientName(plan.client_id)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      <span>{ideas.length} ideas</span>
                    </div>
                    {plan.filming_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(plan.filming_date), 'MMM d')}</span>
                      </div>
                    )}
                  </div>

                  {platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {platforms.slice(0, 3).map(platform => (
                        <Badge key={platform} variant="outline" className="text-xs">
                          {platform}
                        </Badge>
                      ))}
                      {platforms.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{platforms.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {categories.map(cat => (
                        <Badge key={cat} variant="secondary" className="text-xs gap-1">
                          <Tag className="w-3 h-3" />
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  )}

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(plan.created_at), 'MMM d, yyyy')}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlanToShare(plan);
                          }}
                          title="Share for approval"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateContentPlan(plan);
                          }}
                          disabled={isDuplicating}
                          title="Duplicate plan"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlan(plan);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlanToDelete(plan);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Plan Detail Sheet */}
      <Sheet open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="sr-only">{selectedPlan?.title}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 -mx-6 px-6">
            {selectedPlan && (
              <SavedPlanDetail 
                plan={selectedPlan} 
                clientName={getClientName(selectedPlan.client_id)}
                onPlanUpdated={() => setSelectedPlan(prev => prev ? { ...prev } : null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={!!planToDelete}
        onOpenChange={(open) => !open && setPlanToDelete(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        title="Delete Plan"
        description={`Are you sure you want to delete "${planToDelete?.title}"? This action cannot be undone.`}
      />

      {/* Share Link Dialog */}
      {planToShare && (
        <GeneratePlanShareLinkDialog
          open={!!planToShare}
          onOpenChange={(open) => !open && setPlanToShare(null)}
          planId={planToShare.id}
          planTitle={planToShare.title}
        />
      )}
      {/* Paste Scripts Dialog */}
      <PasteScriptsDialog
        open={showPasteDialog}
        onOpenChange={setShowPasteDialog}
        onSave={handlePasteScriptsSave}
        isSaving={isSaving}
        clients={clients}
      />
    </div>
  );
}
