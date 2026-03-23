import { useState } from 'react';
import { Sparkles, Brain, RefreshCw, Target, AlertTriangle, Lightbulb, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useKnowledgeSummary } from '@/hooks/useKnowledgeSummary';
import { useKnowledgeEntries } from '@/hooks/useKnowledgeEntries';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeSummaryPanelProps {
  clientId: string;
  clientName: string;
}

export function KnowledgeSummaryPanel({ clientId, clientName }: KnowledgeSummaryPanelProps) {
  const { summary, upsertSummary, isLoading, isUpserting } = useKnowledgeSummary(clientId);
  const { entries } = useKnowledgeEntries(clientId);
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAnalysis = async () => {
    if (entries.length === 0) {
      toast({
        title: 'No knowledge entries',
        description: 'Add some knowledge base entries first to generate an analysis.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const knowledgeContext = entries.map(e => 
        `[${e.category.toUpperCase()}] ${e.title}: ${e.content}`
      ).join('\n\n');

      const { data, error } = await supabase.functions.invoke('build-knowledge-base', {
        body: {
          clientName,
          knowledgeEntries: knowledgeContext,
          action: 'analyze',
        },
      });

      if (error) throw error;

      // Parse the AI response and save to summary
      upsertSummary({
        client_id: clientId,
        positioning_summary: data.positioning || null,
        key_differentiators: data.differentiators || [],
        content_opportunities: data.opportunities || [],
        compliance_flags: data.compliance || [],
        ideal_customer_profile: data.icp || null,
      });

      toast({ title: 'Analysis generated successfully' });
    } catch (error) {
      console.error('Error generating analysis:', error);
      toast({
        title: 'Failed to generate analysis',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (!summary) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold mb-2">AI Knowledge Analysis</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
            Generate an AI-powered analysis of this client's positioning, differentiators, and content opportunities.
          </p>
          <Button onClick={generateAnalysis} disabled={isGenerating || entries.length === 0}>
            <Sparkles className="h-4 w-4 mr-2" />
            {isGenerating ? 'Analyzing...' : 'Generate Analysis'}
          </Button>
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Add knowledge entries first
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Analysis
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={generateAnalysis}
            disabled={isGenerating || isUpserting}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated: {new Date(summary.generated_at).toLocaleDateString()}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.positioning_summary && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-500" />
              Positioning
            </h4>
            <p className="text-sm text-muted-foreground">{summary.positioning_summary}</p>
          </div>
        )}

        {summary.ideal_customer_profile && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-purple-500" />
              Ideal Customer
            </h4>
            <p className="text-sm text-muted-foreground">{summary.ideal_customer_profile}</p>
          </div>
        )}

        {summary.key_differentiators && summary.key_differentiators.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Key Differentiators</h4>
            <div className="flex flex-wrap gap-1">
              {summary.key_differentiators.map((diff, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{diff}</Badge>
              ))}
            </div>
          </div>
        )}

        {summary.content_opportunities && summary.content_opportunities.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Content Opportunities
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {summary.content_opportunities.slice(0, 3).map((opp, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {opp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.compliance_flags && summary.compliance_flags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Compliance Notes
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {summary.compliance_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-500">!</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
