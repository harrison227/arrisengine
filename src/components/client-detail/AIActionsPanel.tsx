import { useState } from 'react';
import { Sparkles, RefreshCw, FileText, Megaphone, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface AIActionsPanelProps {
  clientId: string;
  clientName: string;
  industry: string;
  website: string | null;
}

type ActionStatus = 'idle' | 'running' | 'complete' | 'error';

export function AIActionsPanel({ clientId, clientName, industry, website }: AIActionsPanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [refreshKBStatus, setRefreshKBStatus] = useState<ActionStatus>('idle');
  const [generateBriefStatus, setGenerateBriefStatus] = useState<ActionStatus>('idle');
  const [suggestAdsStatus, setSuggestAdsStatus] = useState<ActionStatus>('idle');
  const [regenerateStrategyStatus, setRegenerateStrategyStatus] = useState<ActionStatus>('idle');

  const handleRefreshKnowledgeBase = async () => {
    if (!website) {
      toast({
        title: 'No website configured',
        description: 'Add a website URL to the client to enable this feature',
        variant: 'destructive',
      });
      return;
    }

    setRefreshKBStatus('running');
    
    try {
      // Scrape website
      const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke(
        'scrape-client-website',
        { body: { url: website } }
      );

      if (scrapeError || !scrapeData?.success) {
        throw new Error(scrapeData?.error || 'Failed to scrape website');
      }

      // Build knowledge base
      const { data: kbData, error: kbError } = await supabase.functions.invoke(
        'build-knowledge-base',
        { 
          body: { 
            clientId, 
            scrapedData: scrapeData.data,
            userId: user?.id 
          } 
        }
      );

      if (kbError || !kbData?.success) {
        throw new Error(kbData?.error || 'Failed to build knowledge base');
      }

      setRefreshKBStatus('complete');
      queryClient.invalidateQueries({ queryKey: ['knowledge_entries', clientId] });
      
      toast({
        title: 'Knowledge Base Refreshed',
        description: `Added ${kbData.entriesCreated} new entries`,
      });

      setTimeout(() => setRefreshKBStatus('idle'), 3000);
    } catch (error) {
      setRefreshKBStatus('error');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to refresh knowledge base',
        variant: 'destructive',
      });
      setTimeout(() => setRefreshKBStatus('idle'), 3000);
    }
  };

  const handleGenerateBrief = async () => {
    setGenerateBriefStatus('running');
    
    try {
      // This would generate a content brief based on knowledge base
      toast({
        title: 'Generating Content Brief',
        description: 'This will create a detailed filming brief...',
      });

      // For now, we'll use the content strategy function
      const { data, error } = await supabase.functions.invoke(
        'generate-content-strategy',
        { body: { clientId, clientName, industry } }
      );

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to generate brief');
      }

      setGenerateBriefStatus('complete');
      queryClient.invalidateQueries({ queryKey: ['content_plans', clientId] });
      
      toast({
        title: 'Content Brief Generated',
        description: `Created ${data.plansCreated} new content plans`,
      });

      setTimeout(() => setGenerateBriefStatus('idle'), 3000);
    } catch (error) {
      setGenerateBriefStatus('error');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate brief',
        variant: 'destructive',
      });
      setTimeout(() => setGenerateBriefStatus('idle'), 3000);
    }
  };

  const handleSuggestAds = async () => {
    setSuggestAdsStatus('running');
    
    try {
      const { data, error } = await supabase.functions.invoke(
        'suggest-ad-angles',
        { body: { clientId, clientName, industry } }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuggestAdsStatus('complete');
      queryClient.invalidateQueries({ queryKey: ['ad_suggestions', clientId] });
      
      toast({
        title: 'Ad Angles Generated',
        description: `Created ${data.suggestions?.length || 0} new ad angle suggestions`,
      });

      setTimeout(() => setSuggestAdsStatus('idle'), 3000);
    } catch (error) {
      setSuggestAdsStatus('error');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to suggest ad angles',
        variant: 'destructive',
      });
      setTimeout(() => setSuggestAdsStatus('idle'), 3000);
    }
  };

  const handleRegenerateStrategy = async () => {
    setRegenerateStrategyStatus('running');
    
    try {
      const { data, error } = await supabase.functions.invoke(
        'generate-content-strategy',
        { body: { clientId, clientName, industry } }
      );

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to regenerate strategy');
      }

      setRegenerateStrategyStatus('complete');
      queryClient.invalidateQueries({ queryKey: ['content_plans', clientId] });
      
      toast({
        title: 'Strategy Regenerated',
        description: `Created ${data.plansCreated} new content plans`,
      });

      setTimeout(() => setRegenerateStrategyStatus('idle'), 3000);
    } catch (error) {
      setRegenerateStrategyStatus('error');
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to regenerate strategy',
        variant: 'destructive',
      });
      setTimeout(() => setRegenerateStrategyStatus('idle'), 3000);
    }
  };

  const getButtonContent = (status: ActionStatus, defaultIcon: React.ReactNode, defaultText: string, runningText: string) => {
    if (status === 'running') {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {runningText}
        </>
      );
    }
    if (status === 'complete') {
      return (
        <>
          <CheckCircle className="w-4 h-4 text-green-500" />
          Done!
        </>
      );
    }
    return (
      <>
        {defaultIcon}
        {defaultText}
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Actions
        </CardTitle>
        <CardDescription>
          Use AI to automate tasks for this client
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary"
          onClick={handleRefreshKnowledgeBase}
          disabled={refreshKBStatus === 'running' || !website}
        >
          {getButtonContent(
            refreshKBStatus,
            <RefreshCw className="w-5 h-5" />,
            'Refresh Knowledge',
            'Scraping...'
          )}
        </Button>
        
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary"
          onClick={handleGenerateBrief}
          disabled={generateBriefStatus === 'running'}
        >
          {getButtonContent(
            generateBriefStatus,
            <FileText className="w-5 h-5" />,
            'Generate Brief',
            'Generating...'
          )}
        </Button>
        
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary"
          onClick={handleSuggestAds}
          disabled={suggestAdsStatus === 'running'}
        >
          {getButtonContent(
            suggestAdsStatus,
            <Megaphone className="w-5 h-5" />,
            'Suggest Ad Angles',
            'Analyzing...'
          )}
        </Button>
        
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/10 hover:border-primary"
          onClick={handleRegenerateStrategy}
          disabled={regenerateStrategyStatus === 'running'}
        >
          {getButtonContent(
            regenerateStrategyStatus,
            <Sparkles className="w-5 h-5" />,
            'New Strategy',
            'Creating...'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
