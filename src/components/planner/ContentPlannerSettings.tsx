import { useState, useEffect } from 'react';
import { Settings, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAIVoiceSettings } from '@/hooks/useAIVoiceSettings';

const FORMAT_OPTIONS = [
  'Talking Head',
  'Tutorial',
  'B-Roll Heavy',
  'POV',
  'Before/After',
  'Day in Life',
  'Storytime',
  'Listicle',
  'Behind the Scenes',
  'Q&A',
];

const PLATFORM_OPTIONS = [
  'TikTok',
  'Instagram Reels',
  'YouTube Shorts',
  'LinkedIn',
  'Facebook',
];

const HOOK_STYLE_OPTIONS = [
  { value: 'question', label: 'Question-based', example: '"Did you know...?"' },
  { value: 'bold', label: 'Bold statement', example: '"This changed everything"' },
  { value: 'story', label: 'Story opener', example: '"I never expected..."' },
  { value: 'controversial', label: 'Controversial take', example: '"Unpopular opinion..."' },
  { value: 'curiosity', label: 'Curiosity gap', example: '"The secret they don\'t tell you..."' },
  { value: 'relatable', label: 'Relatable moment', example: '"You know that feeling when..."' },
];

export function ContentPlannerSettings() {
  const { settings, isLoading, upsertSettings, isUpdating } = useAIVoiceSettings();
  
  const [masterPrompt, setMasterPrompt] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [hookStyle, setHookStyle] = useState('');
  const [themes, setThemes] = useState<string[]>([]);
  const [newTheme, setNewTheme] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setMasterPrompt(settings.content_planner_master_prompt || '');
      setSelectedFormats(settings.preferred_formats || []);
      setSelectedPlatforms(settings.preferred_platforms || []);
      setHookStyle(settings.preferred_hooks_style || '');
      setThemes(settings.content_themes || []);
    }
  }, [settings]);

  const handleFormatToggle = (format: string) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleAddTheme = () => {
    if (newTheme.trim() && !themes.includes(newTheme.trim())) {
      setThemes(prev => [...prev, newTheme.trim()]);
      setNewTheme('');
    }
  };

  const handleRemoveTheme = (theme: string) => {
    setThemes(prev => prev.filter(t => t !== theme));
  };

  const handleSave = () => {
    upsertSettings({
      content_planner_master_prompt: masterPrompt,
      preferred_formats: selectedFormats,
      preferred_platforms: selectedPlatforms,
      preferred_hooks_style: hookStyle,
      content_themes: themes,
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Content Planner Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Master Prompt */}
          <div className="space-y-2">
            <Label htmlFor="master-prompt" className="text-sm font-medium">
              Master Prompt
            </Label>
            <p className="text-xs text-muted-foreground">
              Custom instructions for how the AI should generate content ideas
            </p>
            <Textarea
              id="master-prompt"
              placeholder="E.g., Always suggest viral hooks. Focus on pain points first. Prefer short punchy content under 30 seconds..."
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          {/* Preferred Formats */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Preferred Formats</Label>
            <p className="text-xs text-muted-foreground">
              Select the content formats you use most often
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((format) => (
                <div key={format} className="flex items-center space-x-2">
                  <Checkbox
                    id={`format-${format}`}
                    checked={selectedFormats.includes(format)}
                    onCheckedChange={() => handleFormatToggle(format)}
                  />
                  <label
                    htmlFor={`format-${format}`}
                    className="text-sm cursor-pointer"
                  >
                    {format}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Preferred Platforms */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Preferred Platforms</Label>
            <p className="text-xs text-muted-foreground">
              Platforms to prioritize when generating ideas
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORM_OPTIONS.map((platform) => (
                <div key={platform} className="flex items-center space-x-2">
                  <Checkbox
                    id={`platform-${platform}`}
                    checked={selectedPlatforms.includes(platform)}
                    onCheckedChange={() => handlePlatformToggle(platform)}
                  />
                  <label
                    htmlFor={`platform-${platform}`}
                    className="text-sm cursor-pointer"
                  >
                    {platform}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Hook Style */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Hook Style</Label>
            <p className="text-xs text-muted-foreground">
              Your preferred style for content hooks
            </p>
            <Select value={hookStyle} onValueChange={setHookStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Select a hook style" />
              </SelectTrigger>
              <SelectContent>
                {HOOK_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.example}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Themes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Content Themes</Label>
            <p className="text-xs text-muted-foreground">
              Topics and angles you want to focus on
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Add a theme..."
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTheme();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddTheme}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {themes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {themes.map((theme) => (
                  <Badge
                    key={theme}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {theme}
                    <button
                      type="button"
                      onClick={() => handleRemoveTheme(theme)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            className="w-full"
          >
            {isUpdating ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
