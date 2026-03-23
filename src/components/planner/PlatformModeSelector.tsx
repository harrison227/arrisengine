import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, FileText, Linkedin, Twitter, ArrowRight } from 'lucide-react';
import { TextPlatform, useContentPlannerGuidelines } from '@/hooks/useContentPlannerGuidelines';

interface PlatformModeSelectorProps {
  onSelectVideo: () => void;
  onSelectTextPlatform: (platform: TextPlatform) => void;
}

export function PlatformModeSelector({ onSelectVideo, onSelectTextPlatform }: PlatformModeSelectorProps) {
  const [step, setStep] = React.useState<'mode' | 'platform'>('mode');
  const { guidelines } = useContentPlannerGuidelines();

  const getGuidelineCount = (platform: TextPlatform) => {
    return guidelines.filter(g => g.platform === platform).length;
  };

  if (step === 'mode') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-2">What do you want to create?</h2>
            <p className="text-muted-foreground">Choose your content type to get started</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
              onClick={onSelectVideo}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Video className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      Video Content
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Short-form videos with scripts, shot lists, and filming day planning
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs">TikTok</Badge>
                      <Badge variant="secondary" className="text-xs">Reels</Badge>
                      <Badge variant="secondary" className="text-xs">Shorts</Badge>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
              onClick={() => setStep('platform')}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                      Text Posts
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Written content with custom guidelines and PDF references
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-xs">LinkedIn</Badge>
                      <Badge variant="secondary" className="text-xs">Twitter/X</Badge>
                      <Badge variant="secondary" className="text-xs">Threads</Badge>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Platform selection step
  const platforms: { id: TextPlatform; name: string; icon: React.ReactNode; description: string }[] = [
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: <Linkedin className="w-6 h-6" />,
      description: 'Long-form thought leadership and professional insights',
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      icon: <Twitter className="w-6 h-6" />,
      description: 'Short tweets and engaging threads',
    },
    {
      id: 'threads',
      name: 'Threads',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.576.878-6.43 2.523-8.483C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.85-.706 2.017-1.115 3.382-1.188 1.073-.057 2.099.053 3.07.328-.021-.848-.143-1.56-.364-2.134-.349-.907-1.01-1.358-2.02-1.378-.746.014-1.357.218-1.816.607-.41.349-.666.833-.76 1.44l-2.087-.29c.16-1.088.622-1.975 1.373-2.636.86-.758 2.005-1.157 3.307-1.152 1.713.034 3.016.67 3.874 1.892.67.955.984 2.247 1.03 4.226.02.184.028.373.028.568 0 .157-.005.31-.013.458a8.372 8.372 0 0 1 1.065.453c1.167.596 2.047 1.478 2.543 2.553.655 1.418.778 3.395-.477 5.623-1.265 2.246-3.378 3.576-6.287 3.958-.39.051-.79.077-1.199.077Zm-.515-9.154c-1.017.053-1.827.335-2.347.819-.44.409-.636.883-.602 1.45.034.567.292 1.035.768 1.392.515.388 1.21.585 2.007.539 1.08-.058 1.925-.463 2.508-1.204.457-.582.749-1.368.87-2.344-.74-.18-1.514-.289-2.31-.289-.3 0-.598.013-.894.037Z"/>
        </svg>
      ),
      description: 'Thread-style connected posts',
    },
  ];

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-4"
            onClick={() => setStep('mode')}
          >
            ← Back
          </Button>
          <h2 className="text-2xl font-semibold text-foreground mb-2">Select Platform</h2>
          <p className="text-muted-foreground">Choose which platform you're creating text posts for</p>
        </div>

        <div className="grid gap-4">
          {platforms.map((platform) => {
            const guidelineCount = getGuidelineCount(platform.id);
            return (
              <Card 
                key={platform.id}
                className="cursor-pointer transition-all hover:border-primary hover:shadow-md group"
                onClick={() => onSelectTextPlatform(platform.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                      {platform.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {platform.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {platform.description}
                      </p>
                    </div>
                    {guidelineCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {guidelineCount} guideline{guidelineCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
