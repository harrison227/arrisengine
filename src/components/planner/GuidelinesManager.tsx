import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings2, Plus, Trash2, Star, FileText, Upload, Loader2, Linkedin, Twitter, Pencil, X, Check } from 'lucide-react';
import { useContentPlannerGuidelines, TextPlatform, ContentPlannerGuideline } from '@/hooks/useContentPlannerGuidelines';

interface GuidelinesManagerProps {
  trigger?: React.ReactNode;
}

export function GuidelinesManager({ trigger }: GuidelinesManagerProps) {
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<TextPlatform>('linkedin');
  
  const [newName, setNewName] = useState('');
  const [newGuidelines, setNewGuidelines] = useState('');
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);

  const {
    guidelines,
    isLoading,
    createGuideline,
    updateGuideline,
    deleteGuideline,
    setDefaultGuideline,
    isCreating: isSaving,
    isUpdating,
    isDeleting,
  } = useContentPlannerGuidelines();

  const platformGuidelines = guidelines.filter(g => g.platform === selectedPlatform);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    await createGuideline({
      platform: selectedPlatform,
      name: newName.trim(),
      textGuidelines: newGuidelines.trim() || undefined,
      pdfFile: newPdfFile || undefined,
    });

    setNewName('');
    setNewGuidelines('');
    setNewPdfFile(null);
    setIsCreating(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setNewPdfFile(file);
    }
  };

  const getPlatformIcon = (platform: TextPlatform) => {
    switch (platform) {
      case 'linkedin':
        return <Linkedin className="w-4 h-4" />;
      case 'twitter':
        return <Twitter className="w-4 h-4" />;
      case 'threads':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.576.878-6.43 2.523-8.483C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.85-.706 2.017-1.115 3.382-1.188 1.073-.057 2.099.053 3.07.328-.021-.848-.143-1.56-.364-2.134-.349-.907-1.01-1.358-2.02-1.378-.746.014-1.357.218-1.816.607-.41.349-.666.833-.76 1.44l-2.087-.29c.16-1.088.622-1.975 1.373-2.636.86-.758 2.005-1.157 3.307-1.152 1.713.034 3.016.67 3.874 1.892.67.955.984 2.247 1.03 4.226.02.184.028.373.028.568 0 .157-.005.31-.013.458a8.372 8.372 0 0 1 1.065.453c1.167.596 2.047 1.478 2.543 2.553.655 1.418.778 3.395-.477 5.623-1.265 2.246-3.378 3.576-6.287 3.958-.39.051-.79.077-1.199.077Zm-.515-9.154c-1.017.053-1.827.335-2.347.819-.44.409-.636.883-.602 1.45.034.567.292 1.035.768 1.392.515.388 1.21.585 2.007.539 1.08-.058 1.925-.463 2.508-1.204.457-.582.749-1.368.87-2.344-.74-.18-1.514-.289-2.31-.289-.3 0-.598.013-.894.037Z"/>
          </svg>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings2 className="w-4 h-4 mr-2" />
            Manage Guidelines
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Content Guidelines</SheetTitle>
        </SheetHeader>

        <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as TextPlatform)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 w-full flex-shrink-0">
            <TabsTrigger value="linkedin" className="flex items-center gap-1.5">
              <Linkedin className="w-3.5 h-3.5" />
              LinkedIn
            </TabsTrigger>
            <TabsTrigger value="twitter" className="flex items-center gap-1.5">
              <Twitter className="w-3.5 h-3.5" />
              Twitter
            </TabsTrigger>
            <TabsTrigger value="threads" className="flex items-center gap-1.5">
              Threads
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full">
              <div className="space-y-4 pr-4">
                {/* Create new guideline form */}
                {isCreating ? (
                  <Card>
                    <CardContent className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          placeholder="e.g., Thought Leadership Style"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Guidelines / Instructions</Label>
                        <Textarea
                          placeholder="Enter your writing guidelines, tone preferences, formatting rules..."
                          value={newGuidelines}
                          onChange={(e) => setNewGuidelines(e.target.value)}
                          rows={6}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reference PDF (optional)</Label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1">
                            <div className="flex items-center justify-center gap-2 h-10 px-4 py-2 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                              <Upload className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {newPdfFile ? newPdfFile.name : 'Upload PDF'}
                              </span>
                            </div>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </label>
                          {newPdfFile && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setNewPdfFile(null)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsCreating(false);
                            setNewName('');
                            setNewGuidelines('');
                            setNewPdfFile(null);
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreate}
                          disabled={!newName.trim() || isSaving}
                          className="flex-1"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Guideline
                  </Button>
                )}

                {/* Existing guidelines list */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : platformGuidelines.length === 0 && !isCreating ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No guidelines saved for {selectedPlatform}</p>
                    <p className="text-xs mt-1">Create one to use when generating content</p>
                  </div>
                ) : (
                  platformGuidelines.map((guideline) => (
                    <GuidelineCard
                      key={guideline.id}
                      guideline={guideline}
                      onDelete={() => deleteGuideline(guideline.id)}
                      onSetDefault={() => setDefaultGuideline({ id: guideline.id, platform: selectedPlatform })}
                      onUpdate={updateGuideline}
                      isDeleting={isDeleting}
                      isUpdating={isUpdating}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function GuidelineCard({
  guideline,
  onDelete,
  onSetDefault,
  onUpdate,
  isDeleting,
  isUpdating,
}: {
  guideline: ContentPlannerGuideline;
  onDelete: () => void;
  onSetDefault: () => void;
  onUpdate: (data: { id: string; name?: string; textGuidelines?: string; pdfFile?: File }) => Promise<any>;
  isDeleting: boolean;
  isUpdating: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(guideline.name);
  const [editGuidelines, setEditGuidelines] = useState(guideline.text_guidelines || '');
  const [editPdfFile, setEditPdfFile] = useState<File | null>(null);

  const handleSave = async () => {
    await onUpdate({
      id: guideline.id,
      name: editName,
      textGuidelines: editGuidelines,
      pdfFile: editPdfFile || undefined,
    });
    setIsEditing(false);
    setEditPdfFile(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName(guideline.name);
    setEditGuidelines(guideline.text_guidelines || '');
    setEditPdfFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setEditPdfFile(file);
    }
  };

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Guidelines / Instructions</Label>
            <Textarea
              value={editGuidelines}
              onChange={(e) => setEditGuidelines(e.target.value)}
              rows={6}
            />
          </div>
          <div className="space-y-2">
            <Label>Reference PDF</Label>
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <div className="flex items-center justify-center gap-2 h-10 px-4 py-2 border border-dashed border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {editPdfFile ? editPdfFile.name : guideline.pdf_filename || 'Upload PDF'}
                  </span>
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
              {(editPdfFile || guideline.pdf_filename) && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditPdfFile(null)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!editName.trim() || isUpdating}
              className="flex-1"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground">{guideline.name}</h4>
            {guideline.is_default && (
              <Badge variant="secondary" className="text-xs">
                <Star className="w-3 h-3 mr-1" />
                Default
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsEditing(true)}
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            {!guideline.is_default && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onSetDefault}
                title="Set as default"
              >
                <Star className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {guideline.text_guidelines && (
          <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
            {guideline.text_guidelines}
          </p>
        )}
        {guideline.pdf_filename && (
          <Badge variant="outline" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            {guideline.pdf_filename}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
