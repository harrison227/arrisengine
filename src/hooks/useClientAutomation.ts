import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type AutomationStep = 
  | 'idle'
  | 'scraping'
  | 'building_knowledge'
  | 'generating_strategy'
  | 'complete'
  | 'error';

export interface AutomationProgress {
  step: AutomationStep;
  message: string;
  progress: number;
}

export function useClientAutomation() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<AutomationProgress>({
    step: 'idle',
    message: '',
    progress: 0,
  });

  const runAutomation = useCallback(async (
    clientId: string,
    websiteUrl: string | null,
    clientName: string,
    industry: string,
    userId: string
  ) => {
    if (!websiteUrl) {
      toast({
        title: 'No website provided',
        description: 'Skipping AI automation - add a website URL to enable auto-population',
        variant: 'default',
      });
      return { success: true, skipped: true };
    }

    setIsRunning(true);
    
    try {
      // Step 1: Scrape website
      setProgress({
        step: 'scraping',
        message: 'Analyzing website...',
        progress: 20,
      });

      const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke(
        'scrape-client-website',
        { body: { url: websiteUrl } }
      );

      if (scrapeError || !scrapeData?.success) {
        console.error('Scrape error:', scrapeError || scrapeData?.error);
        throw new Error(scrapeData?.error || 'Failed to scrape website');
      }

      // Step 2: Build knowledge base
      setProgress({
        step: 'building_knowledge',
        message: 'Building knowledge base...',
        progress: 50,
      });

      const { data: kbData, error: kbError } = await supabase.functions.invoke(
        'build-knowledge-base',
        { 
          body: { 
            clientId, 
            scrapedData: scrapeData.data,
            userId 
          } 
        }
      );

      if (kbError || !kbData?.success) {
        console.error('Knowledge base error:', kbError || kbData?.error);
        throw new Error(kbData?.error || 'Failed to build knowledge base');
      }

      // Step 3: Generate content strategy
      setProgress({
        step: 'generating_strategy',
        message: 'Creating content strategy...',
        progress: 80,
      });

      const { data: strategyData, error: strategyError } = await supabase.functions.invoke(
        'generate-content-strategy',
        { 
          body: { 
            clientId,
            clientName,
            industry
          } 
        }
      );

      if (strategyError || !strategyData?.success) {
        console.error('Strategy error:', strategyError || strategyData?.error);
        throw new Error(strategyData?.error || 'Failed to generate content strategy');
      }

      setProgress({
        step: 'complete',
        message: 'Automation complete!',
        progress: 100,
      });

      toast({
        title: 'AI Automation Complete',
        description: `Created ${kbData.entriesCreated} knowledge entries and ${strategyData.plansCreated} content plans`,
      });

      return { 
        success: true, 
        knowledgeEntries: kbData.entriesCreated,
        contentPlans: strategyData.plansCreated
      };

    } catch (error) {
      console.error('Automation error:', error);
      
      setProgress({
        step: 'error',
        message: error instanceof Error ? error.message : 'Automation failed',
        progress: 0,
      });

      toast({
        title: 'Automation Error',
        description: error instanceof Error ? error.message : 'An error occurred during automation',
        variant: 'destructive',
      });

      return { success: false, error };
    } finally {
      setIsRunning(false);
    }
  }, [toast]);

  const resetProgress = useCallback(() => {
    setProgress({
      step: 'idle',
      message: '',
      progress: 0,
    });
  }, []);

  return {
    runAutomation,
    isRunning,
    progress,
    resetProgress,
  };
}
