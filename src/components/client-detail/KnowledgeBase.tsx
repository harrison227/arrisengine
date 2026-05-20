import { useState } from 'react';
import { Plus, Brain, Users, Trophy, Package, TrendingUp, FileText, Shield, MoreHorizontal, Pencil, Trash2, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKnowledgeEntries } from '@/hooks/useKnowledgeEntries';
import { useKnowledgeSummary } from '@/hooks/useKnowledgeSummary';
import { useAgencySettings } from '@/hooks/useAgencySettings';
import { AddKnowledgeDialog } from '@/components/dialogs/AddKnowledgeDialog';
import { EditKnowledgeDialog } from '@/components/dialogs/EditKnowledgeDialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';
import { KnowledgeSummaryPanel } from '@/components/client-detail/KnowledgeSummaryPanel';
import { Skeleton } from '@/components/ui/skeleton';
// generateKnowledgePdf is dynamically imported on demand — keeps jspdf out of the main bundle.
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Database, Tables } from '@/integrations/supabase/types';

type KnowledgeCategory = Database['public']['Enums']['knowledge_category'];
type KnowledgeEntry = Tables<'knowledge_entries'>;

interface KnowledgeBaseProps {
  clientId: string;
  clientName?: string;
}

const categories: { id: KnowledgeCategory; label: string; icon: typeof Brain }[] = [
  { id: 'brand', label: 'Brand', icon: Brain },
  { id: 'audience', label: 'Audience', icon: Users },
  { id: 'competitors', label: 'Competitors', icon: Trophy },
  { id: 'offers', label: 'Offers', icon: Package },
  { id: 'past_results', label: 'Past Results', icon: TrendingUp },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'compliance', label: 'Compliance', icon: Shield },
];

export function KnowledgeBase({ clientId, clientName = 'Client' }: KnowledgeBaseProps) {
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory>('brand');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<KnowledgeEntry | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const { entries, isLoading, deleteEntry, isDeleting } = useKnowledgeEntries(clientId);
  const { summary } = useKnowledgeSummary(clientId);
  const { settings: agencySettings } = useAgencySettings();

  const filteredEntries = entries.filter(e => e.category === selectedCategory);

  const getCategoryCount = (category: KnowledgeCategory) => {
    return entries.filter(e => e.category === category).length;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDownloadPdf = async () => {
    if (entries.length === 0) {
      toast.error('No knowledge entries to export');
      return;
    }
    
    setIsGeneratingPdf(true);
    try {
      const { generateKnowledgePdf } = await import('@/lib/knowledgePdf');
      await generateKnowledgePdf({
        clientName,
        agencyName: agencySettings?.agency_name || 'Agency',
        entries,
        summary,
      });
      toast.success('Knowledge base PDF downloaded');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDelete = () => {
    if (deletingEntry) {
      deleteEntry(deletingEntry.id, {
        onSuccess: () => setDeletingEntry(null),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-24" />)}
        </div>
        {[1, 2].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2">
      {/* Header with Download Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Knowledge Entries</h3>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
          onClick={handleDownloadPdf}
          disabled={isGeneratingPdf || entries.length === 0}
        >
          {isGeneratingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4" />
          )}
          Download PDF
        </Button>
      </div>
      
      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const count = getCategoryCount(category.id);
          
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                selectedCategory === category.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              <Icon className="w-4 h-4" />
              {category.label}
              {count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-xs',
                  selectedCategory === category.id
                    ? 'bg-primary-foreground/20'
                    : 'bg-muted'
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Entries */}
      <div className="space-y-4">
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-foreground">{entry.title}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDate(entry.updated_at)}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditingEntry(entry)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit Entry
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setDeletingEntry(entry)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Entry
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {entry.content}
              </p>
            </div>
          ))
        ) : (
          <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
            <p className="text-muted-foreground mb-4">
              No entries in {categories.find(c => c.id === selectedCategory)?.label} yet
            </p>
            <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Entry
            </Button>
          </div>
        )}
      </div>

      {filteredEntries.length > 0 && (
        <Button className="mt-4 gap-2" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Entry
        </Button>
      )}

      <AddKnowledgeDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen}
        clientId={clientId}
      />
      
      {editingEntry && (
        <EditKnowledgeDialog
          open={!!editingEntry}
          onOpenChange={(open) => !open && setEditingEntry(null)}
          entry={editingEntry}
        />
      )}
      
      <ConfirmDeleteDialog
        open={!!deletingEntry}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        onConfirm={handleDelete}
        title="Delete Knowledge Entry"
        description={`Are you sure you want to delete "${deletingEntry?.title}"? This action cannot be undone.`}
        isDeleting={isDeleting}
      />
      </div>

      {/* AI Summary Panel */}
      <div className="lg:col-span-1">
        <KnowledgeSummaryPanel clientId={clientId} clientName={clientName} />
      </div>
    </div>
  );
}
