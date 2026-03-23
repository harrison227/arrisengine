import { useState, useEffect } from 'react';
import { Sparkles, Sliders, FileText, Plus, Trash2, Edit2, Save, MessageSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAIVoiceSettings, AITone } from '@/hooks/useAIVoiceSettings';
import { useAIPromptTemplates, PromptCategory } from '@/hooks/useAIPromptTemplates';

const tones: { value: AITone; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' },
  { value: 'bold', label: 'Bold', description: 'Confident and assertive' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { value: 'authoritative', label: 'Authoritative', description: 'Expert and commanding' },
];

const categories: { value: PromptCategory; label: string; icon: typeof FileText }[] = [
  { value: 'content_brief', label: 'Content Brief', icon: FileText },
  { value: 'ad_angles', label: 'Ad Angles', icon: Zap },
  { value: 'strategy', label: 'Strategy', icon: Sparkles },
  { value: 'email', label: 'Email', icon: MessageSquare },
  { value: 'social_post', label: 'Social Post', icon: MessageSquare },
  { value: 'custom', label: 'Custom', icon: FileText },
];

export default function AIPromptStudio() {
  const { settings: voiceSettings, isLoading: voiceLoading, upsertSettings: upsertVoice, isUpdating: voiceUpdating } = useAIVoiceSettings();
  const { templates, isLoading: templatesLoading, createTemplate, updateTemplate, deleteTemplate } = useAIPromptTemplates();

  const [voiceForm, setVoiceForm] = useState({
    tone: 'professional' as AITone,
    formality_level: 3,
    creativity_level: 3,
    custom_instructions: '',
    avoid_phrases: [] as string[],
    preferred_phrases: [] as string[],
  });

  const [newAvoidPhrase, setNewAvoidPhrase] = useState('');
  const [newPreferredPhrase, setNewPreferredPhrase] = useState('');

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'custom' as PromptCategory,
    prompt_text: '',
    variables: [] as string[],
    is_default: false,
    industry_filter: null as string | null,
  });

  useEffect(() => {
    if (voiceSettings) {
      setVoiceForm({
        tone: voiceSettings.tone,
        formality_level: voiceSettings.formality_level,
        creativity_level: voiceSettings.creativity_level,
        custom_instructions: voiceSettings.custom_instructions || '',
        avoid_phrases: voiceSettings.avoid_phrases || [],
        preferred_phrases: voiceSettings.preferred_phrases || [],
      });
    }
  }, [voiceSettings]);

  const handleSaveVoice = () => {
    upsertVoice(voiceForm);
  };

  const addAvoidPhrase = () => {
    if (newAvoidPhrase.trim()) {
      setVoiceForm({ ...voiceForm, avoid_phrases: [...voiceForm.avoid_phrases, newAvoidPhrase.trim()] });
      setNewAvoidPhrase('');
    }
  };

  const removeAvoidPhrase = (phrase: string) => {
    setVoiceForm({ ...voiceForm, avoid_phrases: voiceForm.avoid_phrases.filter(p => p !== phrase) });
  };

  const addPreferredPhrase = () => {
    if (newPreferredPhrase.trim()) {
      setVoiceForm({ ...voiceForm, preferred_phrases: [...voiceForm.preferred_phrases, newPreferredPhrase.trim()] });
      setNewPreferredPhrase('');
    }
  };

  const removePreferredPhrase = (phrase: string) => {
    setVoiceForm({ ...voiceForm, preferred_phrases: voiceForm.preferred_phrases.filter(p => p !== phrase) });
  };

  const handleTemplateSubmit = () => {
    if (editingTemplate) {
      updateTemplate({ id: editingTemplate, ...templateForm });
    } else {
      createTemplate(templateForm);
    }
    setTemplateDialogOpen(false);
    setEditingTemplate(null);
    setTemplateForm({ name: '', category: 'custom', prompt_text: '', variables: [], is_default: false, industry_filter: null });
  };

  const openEditTemplate = (template: typeof templates[0]) => {
    setEditingTemplate(template.id);
    setTemplateForm({
      name: template.name,
      category: template.category,
      prompt_text: template.prompt_text,
      variables: template.variables || [],
      is_default: template.is_default,
      industry_filter: template.industry_filter,
    });
    setTemplateDialogOpen(true);
  };

  if (voiceLoading || templatesLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          AI Prompt Studio
        </h1>
        <p className="text-muted-foreground mt-1">Customize how AI generates content for your agency</p>
      </div>

      <Tabs defaultValue="voice" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="voice" className="flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            Voice & Tone
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Prompt Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voice" className="space-y-6">
          {/* Tone Selection */}
          <Card>
            <CardHeader>
              <CardTitle>AI Voice</CardTitle>
              <CardDescription>Define how AI writes content for your clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Tone</Label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {tones.map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => setVoiceForm({ ...voiceForm, tone: tone.value })}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        voiceForm.tone === tone.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-secondary hover:border-primary/50'
                      }`}
                    >
                      <p className="font-medium text-foreground">{tone.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{tone.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center justify-between mb-3">
                      <span>Formality Level</span>
                      <span className="text-sm text-muted-foreground">
                        {voiceForm.formality_level === 1 ? 'Very Casual' : 
                         voiceForm.formality_level === 2 ? 'Casual' :
                         voiceForm.formality_level === 3 ? 'Balanced' :
                         voiceForm.formality_level === 4 ? 'Formal' : 'Very Formal'}
                      </span>
                    </Label>
                    <Slider
                      value={[voiceForm.formality_level]}
                      onValueChange={([value]) => setVoiceForm({ ...voiceForm, formality_level: value })}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Casual</span>
                      <span>Formal</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center justify-between mb-3">
                      <span>Creativity Level</span>
                      <span className="text-sm text-muted-foreground">
                        {voiceForm.creativity_level === 1 ? 'Conservative' : 
                         voiceForm.creativity_level === 2 ? 'Moderate' :
                         voiceForm.creativity_level === 3 ? 'Balanced' :
                         voiceForm.creativity_level === 4 ? 'Creative' : 'Very Creative'}
                      </span>
                    </Label>
                    <Slider
                      value={[voiceForm.creativity_level]}
                      onValueChange={([value]) => setVoiceForm({ ...voiceForm, creativity_level: value })}
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Safe</span>
                      <span>Bold</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custom Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Instructions</CardTitle>
              <CardDescription>Specific rules the AI should always follow</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={voiceForm.custom_instructions}
                onChange={(e) => setVoiceForm({ ...voiceForm, custom_instructions: e.target.value })}
                placeholder="e.g., Always include a call-to-action. Never use emojis. Focus on pain points before solutions..."
                className="min-h-[120px] bg-secondary border-border"
              />
            </CardContent>
          </Card>

          {/* Phrases */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-destructive">Phrases to Avoid</CardTitle>
                <CardDescription>Words or phrases the AI should never use</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newAvoidPhrase}
                    onChange={(e) => setNewAvoidPhrase(e.target.value)}
                    placeholder="Add phrase..."
                    onKeyDown={(e) => e.key === 'Enter' && addAvoidPhrase()}
                    className="bg-secondary border-border"
                  />
                  <Button onClick={addAvoidPhrase} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {voiceForm.avoid_phrases.map((phrase) => (
                    <Badge key={phrase} variant="destructive" className="flex items-center gap-1">
                      {phrase}
                      <button onClick={() => removeAvoidPhrase(phrase)} className="ml-1 hover:text-foreground">
                        ×
                      </button>
                    </Badge>
                  ))}
                  {voiceForm.avoid_phrases.length === 0 && (
                    <p className="text-sm text-muted-foreground">No phrases added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-primary">Preferred Phrases</CardTitle>
                <CardDescription>Words or phrases the AI should use often</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Input
                    value={newPreferredPhrase}
                    onChange={(e) => setNewPreferredPhrase(e.target.value)}
                    placeholder="Add phrase..."
                    onKeyDown={(e) => e.key === 'Enter' && addPreferredPhrase()}
                    className="bg-secondary border-border"
                  />
                  <Button onClick={addPreferredPhrase} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {voiceForm.preferred_phrases.map((phrase) => (
                    <Badge key={phrase} className="flex items-center gap-1">
                      {phrase}
                      <button onClick={() => removePreferredPhrase(phrase)} className="ml-1 hover:text-foreground">
                        ×
                      </button>
                    </Badge>
                  ))}
                  {voiceForm.preferred_phrases.length === 0 && (
                    <p className="text-sm text-muted-foreground">No phrases added yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveVoice} disabled={voiceUpdating} size="lg">
              <Save className="w-4 h-4 mr-2" />
              {voiceUpdating ? 'Saving...' : 'Save Voice Settings'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Prompt Templates</CardTitle>
                <CardDescription>Reusable templates for AI-generated content</CardDescription>
              </div>
              <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingTemplate(null);
                    setTemplateForm({ name: '', category: 'custom', prompt_text: '', variables: [], is_default: false, industry_filter: null });
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{editingTemplate ? 'Edit' : 'Create'} Prompt Template</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Template Name</Label>
                        <Input
                          value={templateForm.name}
                          onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                          placeholder="e.g., E-commerce Ad Hook Generator"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={templateForm.category}
                          onValueChange={(value: PromptCategory) => setTemplateForm({ ...templateForm, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Industry Filter (optional)</Label>
                      <Input
                        value={templateForm.industry_filter || ''}
                        onChange={(e) => setTemplateForm({ ...templateForm, industry_filter: e.target.value || null })}
                        placeholder="e.g., E-commerce, SaaS, Healthcare"
                      />
                      <p className="text-xs text-muted-foreground">Leave empty to use for all industries</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Prompt Template</Label>
                      <Textarea
                        value={templateForm.prompt_text}
                        onChange={(e) => setTemplateForm({ ...templateForm, prompt_text: e.target.value })}
                        placeholder="Write your prompt template here. Use {{variable}} for dynamic content.

Example:
Generate 5 ad hooks for {{client_name}}, a {{industry}} business.
Their target audience is {{target_audience}}.
Focus on: {{pain_points}}
Include a sense of urgency and social proof."
                        className="min-h-[250px] font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Available variables: {"{{client_name}}"}, {"{{industry}}"}, {"{{target_audience}}"}, {"{{pain_points}}"}, {"{{brand_voice}}"}, {"{{key_benefits}}"}
                      </p>
                    </div>

                    <Button onClick={handleTemplateSubmit} className="w-full">
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground">No templates yet</p>
                  <p className="text-muted-foreground">Create your first prompt template to get started</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {templates.map((template) => {
                    const category = categories.find(c => c.value === template.category);
                    const Icon = category?.icon || FileText;
                    return (
                      <div key={template.id} className="flex items-start justify-between p-4 bg-secondary rounded-lg">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-primary/20">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{template.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1 max-w-xl">
                              {template.prompt_text.slice(0, 150)}...
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{category?.label}</Badge>
                              {template.industry_filter && (
                                <Badge variant="secondary">{template.industry_filter}</Badge>
                              )}
                              {template.is_default && (
                                <Badge className="bg-primary/20 text-primary">Default</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEditTemplate(template)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteTemplate(template.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
