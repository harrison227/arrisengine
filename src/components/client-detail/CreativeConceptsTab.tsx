import { useState } from 'react';
import { Plus, MoreHorizontal, Edit, Trash2, Sparkles, Target, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useCreativeConcepts, CreativeConcept } from '@/hooks/useCreativeConcepts';
import { CreativeConceptDialog } from '@/components/dialogs/CreativeConceptDialog';
import { ConfirmDeleteDialog } from '@/components/dialogs/ConfirmDeleteDialog';

interface CreativeConceptsTabProps {
  clientId: string;
}

const statusColors: Record<string, string> = {
  idea: 'bg-gray-100 text-gray-700 border-gray-200',
  in_development: 'bg-blue-100 text-blue-700 border-blue-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  paused: 'bg-amber-100 text-amber-700 border-amber-200',
  retired: 'bg-red-100 text-red-700 border-red-200',
};

const emotionEmojis: Record<string, string> = {
  trust: '🤝',
  excitement: '🎉',
  curiosity: '🤔',
  urgency: '⚡',
  fear: '😰',
  desire: '💫',
  belonging: '🏠',
  pride: '🏆',
};

export function CreativeConceptsTab({ clientId }: CreativeConceptsTabProps) {
  const { concepts, getVariationsForConcept, updateConcept, deleteConcept, isLoading } = useCreativeConcepts(clientId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConcept, setEditingConcept] = useState<CreativeConcept | null>(null);
  const [deletingConcept, setDeletingConcept] = useState<CreativeConcept | null>(null);

  const handleStatusChange = (conceptId: string, newStatus: string) => {
    updateConcept({ id: conceptId, status: newStatus as CreativeConcept['status'] });
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Creative Concepts</h2>
          <p className="text-sm text-muted-foreground">Ad angles and messaging strategies</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Concept
        </Button>
      </div>

      {concepts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium mb-1">No creative concepts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create ad angles and messaging strategies for this client
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Concept
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {concepts.map(concept => {
            const variations = getVariationsForConcept(concept.id);
            return (
              <Card key={concept.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{emotionEmojis[concept.target_emotion] || '💡'}</span>
                        <h3 className="font-semibold truncate">"{concept.hook}"</h3>
                        {concept.ai_generated && (
                          <Badge variant="secondary" className="shrink-0">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {concept.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{concept.format}</Badge>
                        <Badge variant="outline">{concept.platform}</Badge>
                        {concept.target_audiences?.slice(0, 2).map((audience, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            <Target className="h-3 w-3 mr-1" />
                            {audience}
                          </Badge>
                        ))}
                        {variations.length > 0 && (
                          <Badge variant="secondary">{variations.length} variations</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Select 
                        value={concept.status} 
                        onValueChange={(v) => handleStatusChange(concept.id, v)}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="idea">Idea</SelectItem>
                          <SelectItem value="in_development">In Development</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="retired">Retired</SelectItem>
                        </SelectContent>
                      </Select>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingConcept(concept)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Concept
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingConcept(concept)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {concept.cta_options && concept.cta_options.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">CTAs:</p>
                      <div className="flex flex-wrap gap-1">
                        {concept.cta_options.map((cta, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{cta}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {concept.performance_notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Performance Notes:</p>
                      <p className="text-sm">{concept.performance_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreativeConceptDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        clientId={clientId}
      />

      {editingConcept && (
        <CreativeConceptDialog
          open={!!editingConcept}
          onOpenChange={(open) => !open && setEditingConcept(null)}
          clientId={clientId}
          concept={editingConcept}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deletingConcept}
        onOpenChange={(open) => !open && setDeletingConcept(null)}
        onConfirm={() => {
          if (deletingConcept) {
            deleteConcept(deletingConcept.id);
            setDeletingConcept(null);
          }
        }}
        title="Delete Creative Concept"
        description={`Are you sure you want to delete "${deletingConcept?.hook}"?`}
      />
    </div>
  );
}
