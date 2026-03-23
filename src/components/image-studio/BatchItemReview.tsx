import React, { useState, useEffect } from 'react';
import { Check, SkipForward, RefreshCw, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageBatchItem } from '@/hooks/useImageBatch';

type ImageModel = 'nano-banana' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface BatchItemReviewProps {
  item: ImageBatchItem;
  onApprove: () => void;
  onSkip: () => void;
  onRegenerate: (feedback?: string, model?: ImageModel) => void;
  isGenerating: boolean;
}

export function BatchItemReview({ 
  item, 
  onApprove, 
  onSkip, 
  onRegenerate, 
  isGenerating 
}: BatchItemReviewProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedModel, setSelectedModel] = useState<ImageModel>(
    (item.model_used as ImageModel) || 'nano-banana'
  );

  // Update selected model when item changes
  useEffect(() => {
    setSelectedModel((item.model_used as ImageModel) || 'nano-banana');
  }, [item.model_used]);

  const handleRegenerateWithFeedback = () => {
    onRegenerate(feedback, selectedModel);
    setFeedback('');
    setShowFeedback(false);
  };

  const modelLabels: Record<ImageModel, string> = {
    'nano-banana': 'Nano Banana Pro',
    'dalle3': 'DALL-E 3',
    'gpt-image-1.5': 'GPT Image 1.5',
    'ideogram': 'Ideogram 3.0',
  };

  return (
    <Card className="bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">#{item.sequence_number}</Badge>
              <Badge variant="outline">{item.template_type.replace('_', ' ')}</Badge>
              <Badge variant="outline">{item.platform}</Badge>
              {item.model_used && (
                <Badge variant="secondary" className="text-xs">
                  {modelLabels[item.model_used as ImageModel] || item.model_used}
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground">{item.concept}</p>
          </div>
          {item.attempts > 0 && (
            <span className="text-xs text-muted-foreground">
              Attempt {item.attempts}
            </span>
          )}
        </div>

        {/* Image Preview */}
        <div className="aspect-square rounded-lg overflow-hidden bg-muted mb-4 relative">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Generating image...</p>
              
              {/* Live feedback input while generating */}
              <div className="w-full max-w-xs space-y-2">
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add feedback for next regeneration..."
                  className="min-h-[60px] text-xs bg-background/80 backdrop-blur-sm"
                />
                {feedback.trim() && (
                  <p className="text-xs text-muted-foreground text-center">
                    Feedback will be used on next regeneration
                  </p>
                )}
              </div>
            </div>
          ) : item.generated_image_url ? (
            <img
              src={item.generated_image_url}
              alt={item.concept}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Click Generate to create image</p>
            </div>
          )}
        </div>

        {/* Previous feedback */}
        {item.feedback && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Previous feedback:</p>
            <p className="text-sm">{item.feedback}</p>
          </div>
        )}

        {/* Feedback input with model selector */}
        {showFeedback && (
          <div className="mb-4 space-y-3">
            {/* Model Selector */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Model:</Label>
              <Select value={selectedModel} onValueChange={(val: ImageModel) => setSelectedModel(val)}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nano-banana">Nano Banana Pro</SelectItem>
                  <SelectItem value="dalle3">DALL-E 3</SelectItem>
                  <SelectItem value="gpt-image-1.5">GPT Image 1.5</SelectItem>
                  <SelectItem value="ideogram">Ideogram 3.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe what you'd like changed (e.g., 'Make it darker', 'Use different font')"
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleRegenerateWithFeedback}
                disabled={isGenerating}
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate{feedback.trim() ? ' with Feedback' : ''}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowFeedback(false);
                  setFeedback('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!showFeedback && (
          <div className="flex items-center gap-2">
            {!item.generated_image_url && !isGenerating ? (
              <Button onClick={() => onRegenerate(undefined, selectedModel)} className="flex-1">
                Generate Image
              </Button>
            ) : (
              <>
                <Button 
                  onClick={onApprove} 
                  disabled={!item.generated_image_url || isGenerating}
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setShowFeedback(true)}
                  disabled={isGenerating}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Feedback
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => onRegenerate(undefined, selectedModel)}
                  disabled={isGenerating}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost"
                  onClick={onSkip}
                  disabled={isGenerating}
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Skip
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}