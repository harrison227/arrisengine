import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Video, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Download,
  Calendar,
  FileText,
  Music,
  ListOrdered,
  Trash2,
  Pencil,
  GripVertical,
  Plus,
  Check,
  X,
  MessageSquare,
  Save,
  Sparkles,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAgencySettings } from '@/hooks/useAgencySettings';
import { useContentPlans } from '@/hooks/useContentPlans';
import { useKnowledgeEntries } from '@/hooks/useKnowledgeEntries';
import { supabase } from '@/integrations/supabase/client';
// jsPDF is dynamically imported inside handleDownloadPDF — keeps it out of the main bundle.
import { cn } from '@/lib/utils';
import { PlanFeedbackSection } from './PlanFeedbackSection';

type ContentPlan = Tables<'content_plans'>;

interface ContentIdea {
  hook: string;
  script?: string;
  shotList?: string[];
  audioSuggestion?: string;
  formatType: string;
  platform: string | string[];
  trendingAngle?: string;
  duration?: number;
  category?: string;
}

interface SavedPlanDetailProps {
  plan: ContentPlan;
  clientName: string;
  onPlanUpdated?: () => void;
}

function parseContentIdeas(brief: string | null): ContentIdea[] {
  if (!brief) return [];
  try {
    const parsed = JSON.parse(brief);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const formatScript = (script: string): { label: string; content: string }[] => {
  const regex = /\[(HOOK|MAIN|CTA)\]/gi;
  const parts = script.split(regex).filter(Boolean);
  
  const result: { label: string; content: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const upperPart = part.toUpperCase();
    
    if (upperPart === 'HOOK' || upperPart === 'MAIN' || upperPart === 'CTA') {
      const content = parts[i + 1]?.trim();
      if (content) {
        result.push({ label: upperPart, content });
        i++;
      }
    }
  }
  
  if (result.length === 0 && script.trim()) {
    return [{ label: 'SCRIPT', content: script.trim() }];
  }
  
  return result;
};

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Twitter'];
const FORMATS = ['Talking Head', 'B-Roll', 'Tutorial', 'Behind the Scenes', 'Interview', 'Product Demo', 'Testimonial'];

// Helper function to format platform names for client-facing content
const formatPlatformName = (platform: string): string => {
  const platformMap: Record<string, string> = {
    'instagram_reels': 'Instagram Reels',
    'instagram_stories': 'Instagram Stories',
    'instagram_posts': 'Instagram Posts',
    'instagram': 'Instagram',
    'tiktok': 'TikTok',
    'youtube': 'YouTube',
    'youtube_shorts': 'YouTube Shorts',
    'facebook': 'Facebook',
    'linkedin': 'LinkedIn',
    'twitter': 'Twitter',
    'x': 'X',
  };
  return platformMap[platform.toLowerCase()] || 
    platform.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

// Helper function to format format types for client-facing content
const formatFormatType = (formatType: string): string => {
  const formatMap: Record<string, string> = {
    'talking_head': 'Talking Head',
    'b_roll': 'B-Roll',
    'b-roll': 'B-Roll',
    'voiceover': 'Voiceover',
    'interview': 'Interview',
    'tutorial': 'Tutorial',
    'behind_the_scenes': 'Behind the Scenes',
    'product_demo': 'Product Demo',
    'testimonial': 'Testimonial',
  };
  return formatMap[formatType.toLowerCase()] || 
    formatType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

export function SavedPlanDetail({ plan, clientName, onPlanUpdated }: SavedPlanDetailProps) {
  const [expandedScripts, setExpandedScripts] = useState<Record<number, boolean>>({});
  const [ideas, setIdeas] = useState<ContentIdea[]>(() => parseContentIdeas(plan.brief));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [agencyNotes, setAgencyNotes] = useState(plan.strategy_notes || '');
  const [isNotesExpanded, setIsNotesExpanded] = useState(true);
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(plan.title);
  
  // Inline script editing state
  const [editingScriptIndex, setEditingScriptIndex] = useState<number | null>(null);
  const [editingScriptValue, setEditingScriptValue] = useState('');
  
  // Filming date editing state
  const [isEditingFilmingDate, setIsEditingFilmingDate] = useState(false);
  const [editedFilmingDate, setEditedFilmingDate] = useState(plan.filming_date || '');
  
  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateTargetIndex, setRegenerateTargetIndex] = useState<number | null>(null);
  
  // Auto-save ref to track if this is initial mount
  const isInitialMount = useRef(true);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { toast } = useToast();
  const { settings: agencySettings } = useAgencySettings();
  const { updateContentPlan, isUpdating } = useContentPlans();
  const { entries: knowledgeEntries } = useKnowledgeEntries(plan.client_id);
  
  const platforms = [...new Set(ideas.flatMap(i => 
    Array.isArray(i.platform) ? i.platform : [i.platform]
  ))];
  const formats = [...new Set(ideas.map(i => i.formatType))];
  
  const hasNotesChanges = agencyNotes !== (plan.strategy_notes || '');

  // Handle saving title
  const handleSaveTitle = () => {
    if (!editedTitle.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title for the plan.', variant: 'destructive' });
      return;
    }
    updateContentPlan({ id: plan.id, title: editedTitle.trim() });
    setIsEditingTitle(false);
    onPlanUpdated?.();
    toast({ title: 'Title updated', description: 'Plan title has been saved.' });
  };

  // Inline script editing handlers
  const handleStartScriptEdit = (index: number) => {
    setEditingScriptIndex(index);
    setEditingScriptValue(ideas[index].script || '');
  };

  const handleSaveScriptEdit = () => {
    if (editingScriptIndex === null) return;
    const newIdeas = [...ideas];
    newIdeas[editingScriptIndex] = { ...newIdeas[editingScriptIndex], script: editingScriptValue };
    setIdeas(newIdeas);
    setEditingScriptIndex(null);
    setEditingScriptValue('');
    setHasChanges(true);
  };

  const handleCancelScriptEdit = () => {
    setEditingScriptIndex(null);
    setEditingScriptValue('');
  };

  // Filming date editing handler
  const handleSaveFilmingDate = () => {
    updateContentPlan({ id: plan.id, filming_date: editedFilmingDate || null });
    setIsEditingFilmingDate(false);
    onPlanUpdated?.();
    toast({ title: 'Filming date updated' });
  };

  // Auto-save when ideas change (debounced)
  useEffect(() => {
    // Skip auto-save on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!hasChanges) return;

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(() => {
      updateContentPlan({
        id: plan.id,
        brief: JSON.stringify(ideas),
      });
      setHasChanges(false);
      onPlanUpdated?.();
    }, 1500); // 1.5 second debounce

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [ideas, hasChanges, plan.id, updateContentPlan, onPlanUpdated]);

  const toggleScript = (index: number) => {
    setExpandedScripts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCopyAllScripts = () => {
    const allScripts = ideas
      .filter(idea => idea.script)
      .map((idea, i) => `--- Idea ${i + 1}: ${idea.hook} ---\n\n${idea.script}`)
      .join('\n\n');
    
    navigator.clipboard.writeText(allScripts);
    toast({ title: 'Copied!', description: 'All scripts copied to clipboard' });
  };

  const handleSaveChanges = useCallback(() => {
    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    updateContentPlan({
      id: plan.id,
      brief: JSON.stringify(ideas),
    });
    setHasChanges(false);
    onPlanUpdated?.();
  }, [ideas, plan.id, updateContentPlan, onPlanUpdated]);

  const handleSaveNotes = useCallback(() => {
    updateContentPlan({
      id: plan.id,
      strategy_notes: agencyNotes,
    });
    toast({ title: 'Notes saved', description: 'Your notes have been saved.' });
    onPlanUpdated?.();
  }, [agencyNotes, plan.id, updateContentPlan, onPlanUpdated, toast]);

  const handleDeleteIdea = (index: number) => {
    const newIdeas = ideas.filter((_, i) => i !== index);
    setIdeas(newIdeas);
    setHasChanges(true);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingIdea({ ...ideas[index] });
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingIdea(null);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingIdea) return;
    const newIdeas = [...ideas];
    newIdeas[editingIndex] = editingIdea;
    setIdeas(newIdeas);
    setEditingIndex(null);
    setEditingIdea(null);
    setHasChanges(true);
  };

  const handleAddIdea = () => {
    const newIdea: ContentIdea = {
      hook: 'New content idea',
      script: '',
      platform: ['Instagram'],
      formatType: 'Talking Head',
      duration: 60,
    };
    // Add to top of list
    setIdeas([newIdea, ...ideas]);
    setHasChanges(true);
    // Start editing the new idea (now at index 0)
    setEditingIndex(0);
    setEditingIdea(newIdea);
  };

  // Build rich client context from knowledge entries
  const buildClientContext = useCallback(() => {
    let context = `Client: ${clientName}\n\n`;
    
    if (knowledgeEntries && knowledgeEntries.length > 0) {
      context += "=== CLIENT KNOWLEDGE BASE ===\n\n";
      knowledgeEntries.forEach(entry => {
        context += `**${entry.title}** (${entry.category}):\n${entry.content}\n\n`;
      });
    }
    
    return context;
  }, [clientName, knowledgeEntries]);

  // AI Generation handlers
  const handleGenerateIdea = async () => {
    if (!generatePrompt.trim()) {
      toast({ title: 'Please enter a prompt', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-single-idea', {
        body: { 
          prompt: generatePrompt,
          clientContext: buildClientContext(),
        },
      });

      if (error) throw error;

      if (data?.idea) {
        // Add generated idea to top
        setIdeas([data.idea, ...ideas]);
        setHasChanges(true);
        setGeneratePrompt('');
        setShowGenerateDialog(false);
        toast({ title: 'Idea generated!', description: 'New content idea added to your plan.' });
      }
    } catch (error: any) {
      console.error('Error generating idea:', error);
      toast({ 
        title: 'Generation failed', 
        description: error.message || 'Failed to generate idea. Please try again.',
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateIdea = async (index: number) => {
    if (!regeneratePrompt.trim()) {
      toast({ title: 'Please enter guidance for regeneration', variant: 'destructive' });
      return;
    }

    setRegeneratingIndex(index);
    try {
      const existingIdea = ideas[index];
      const { data, error } = await supabase.functions.invoke('generate-single-idea', {
        body: { 
          prompt: regeneratePrompt,
          clientContext: buildClientContext(),
          existingIdea,
        },
      });

      if (error) throw error;

      if (data?.idea) {
        const newIdeas = [...ideas];
        newIdeas[index] = data.idea;
        setIdeas(newIdeas);
        setHasChanges(true);
        setRegeneratePrompt('');
        setShowRegenerateDialog(false);
        setRegenerateTargetIndex(null);
        toast({ title: 'Idea regenerated!', description: 'Content idea has been updated.' });
      }
    } catch (error: any) {
      console.error('Error regenerating idea:', error);
      toast({ 
        title: 'Regeneration failed', 
        description: error.message || 'Failed to regenerate idea. Please try again.',
        variant: 'destructive' 
      });
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const openRegenerateDialog = (index: number) => {
    setRegenerateTargetIndex(index);
    setRegeneratePrompt('');
    setShowRegenerateDialog(true);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newIdeas = [...ideas];
    const draggedItem = newIdeas[draggedIndex];
    newIdeas.splice(draggedIndex, 1);
    newIdeas.splice(index, 0, draggedItem);
    setIdeas(newIdeas);
    setDraggedIndex(index);
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 45, g: 55, b: 72 };
  };

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 25;
    const contentWidth = pageWidth - margin * 2;
    
    // Brand colors - Dark grey theme
    const primaryColor = { r: 45, g: 55, b: 72 }; // Slate 700
    const accentColor = { r: 71, g: 85, b: 105 }; // Slate 600
    const textDark = { r: 30, g: 41, b: 59 }; // Slate 800
    const textMuted = { r: 100, g: 116, b: 139 }; // Slate 500
    const lightBg = { r: 248, g: 250, b: 252 }; // Slate 50
    
    const agencyName = agencySettings?.agency_name || 'Content Studio';
    
    // ============ COVER PAGE ============
    
    // Background accent bar at top
    pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.rect(0, 0, pageWidth, 45, 'F');
    
    // Decorative accent line
    pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    pdf.rect(0, 45, pageWidth, 3, 'F');
    
    // Agency name on cover
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(agencyName.toUpperCase(), margin, 28);
    
    // "CONTENT PLAN" label
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(200, 200, 200);
    pdf.text('CONTENT PLAN', pageWidth - margin - 35, 28);
    
    // Plan title - large and prominent
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(textDark.r, textDark.g, textDark.b);
    const titleLines = pdf.splitTextToSize(plan.title, contentWidth);
    let yPos = 85;
    titleLines.forEach((line: string) => {
      pdf.text(line, margin, yPos);
      yPos += 14;
    });
    
    // Decorative line under title
    pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.setLineWidth(1);
    pdf.line(margin, yPos + 5, margin + 60, yPos + 5);
    
    yPos += 25;
    
    // Client name
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text(`Prepared for: ${clientName}`, margin, yPos);
    yPos += 12;
    
    // Date
    pdf.setFontSize(12);
    pdf.text(format(new Date(plan.created_at), 'MMMM d, yyyy'), margin, yPos);
    yPos += 30;
    
    // Stats boxes
    const boxWidth = (contentWidth - 20) / 3;
    const boxHeight = 45;
    const boxY = yPos;
    
    // Ideas count box
    pdf.setFillColor(lightBg.r, lightBg.g, lightBg.b);
    pdf.roundedRect(margin, boxY, boxWidth, boxHeight, 3, 3, 'F');
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text(String(ideas.length), margin + boxWidth / 2, boxY + 22, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('CONTENT IDEAS', margin + boxWidth / 2, boxY + 35, { align: 'center' });
    
    // Platforms count box
    pdf.setFillColor(lightBg.r, lightBg.g, lightBg.b);
    pdf.roundedRect(margin + boxWidth + 10, boxY, boxWidth, boxHeight, 3, 3, 'F');
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text(String(platforms.length), margin + boxWidth + 10 + boxWidth / 2, boxY + 22, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('PLATFORMS', margin + boxWidth + 10 + boxWidth / 2, boxY + 35, { align: 'center' });
    
    // Formats count box
    pdf.setFillColor(lightBg.r, lightBg.g, lightBg.b);
    pdf.roundedRect(margin + (boxWidth + 10) * 2, boxY, boxWidth, boxHeight, 3, 3, 'F');
    pdf.setFontSize(28);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text(String(formats.length), margin + (boxWidth + 10) * 2 + boxWidth / 2, boxY + 22, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('FORMATS', margin + (boxWidth + 10) * 2 + boxWidth / 2, boxY + 35, { align: 'center' });
    
    yPos = boxY + boxHeight + 25;
    
    // Filming date if exists
    if (plan.filming_date) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.text('FILMING DATE', margin, yPos);
      yPos += 8;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(textDark.r, textDark.g, textDark.b);
      pdf.text(format(new Date(plan.filming_date), 'EEEE, MMMM d, yyyy'), margin, yPos);
      yPos += 15;
    }
    
    // Platforms list
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text('PLATFORMS', margin, yPos);
    yPos += 8;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textDark.r, textDark.g, textDark.b);
    const platformsText = [...new Set(ideas.flatMap(i => Array.isArray(i.platform) ? i.platform : [i.platform]))].map(p => formatPlatformName(p)).join('  •  ');
    pdf.text(platformsText, margin, yPos);
    
    // Footer on cover page
    pdf.setFontSize(9);
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text(`Prepared on ${format(new Date(), 'MMMM d, yyyy')}`, margin, pageHeight - 20);
    pdf.text('CONFIDENTIAL', pageWidth - margin - 30, pageHeight - 20);
    
    // ============ CONTENT PAGES ============
    
    const addPageHeader = (pageNum: number) => {
      // Header bar
      pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.rect(0, 0, pageWidth, 20, 'F');
      
      // Plan title in header
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(plan.title.substring(0, 50), margin, 13);
      
      // Page number
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Page ${pageNum}`, pageWidth - margin - 15, 13);
    };
    
    const addPageFooter = () => {
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.3);
      pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      pdf.setFontSize(8);
      pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      pdf.text(agencyName, margin, pageHeight - 8);
      pdf.text('CONFIDENTIAL', pageWidth - margin - 28, pageHeight - 8);
    };
    
    let pageNum = 1;
    
    // Add first content page
    pdf.addPage();
    pageNum++;
    addPageHeader(pageNum);
    addPageFooter();
    
    yPos = 35;
    
    // Section title
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(textDark.r, textDark.g, textDark.b);
    pdf.text('Content Ideas', margin, yPos);
    yPos += 15;
    
    // Render each idea
    ideas.forEach((idea, index) => {
      // Check if we need a new page (leave room for at least the header)
      if (yPos > pageHeight - 80) {
        pdf.addPage();
        pageNum++;
        addPageHeader(pageNum);
        addPageFooter();
        yPos = 35;
      }
      
      const ideaStartY = yPos;
      
      // Idea number circle
      pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.circle(margin + 6, yPos + 3, 6, 'F');
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(index + 1), margin + 6, yPos + 6.5, { align: 'center' });
      
      // Hook/Title
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(textDark.r, textDark.g, textDark.b);
      const hookLines = pdf.splitTextToSize(idea.hook, contentWidth - 20);
      let hookY = yPos;
      hookLines.forEach((line: string, lineIndex: number) => {
        if (lineIndex === 0) {
          pdf.text(line, margin + 16, hookY + 5);
        } else {
          hookY += 6;
          pdf.text(line, margin + 16, hookY + 5);
        }
      });
      yPos = hookY + 14;
      
      // Platform badges and format
      const platformsArr = Array.isArray(idea.platform) ? idea.platform : [idea.platform];
      let badgeX = margin + 16;
      pdf.setFontSize(8);
      platformsArr.forEach((p: string) => {
        const formattedPlatform = formatPlatformName(p);
        const badgeWidth = pdf.getTextWidth(formattedPlatform) + 8;
        pdf.setFillColor(lightBg.r, lightBg.g, lightBg.b);
        pdf.roundedRect(badgeX, yPos - 4, badgeWidth, 10, 2, 2, 'F');
        pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.text(formattedPlatform, badgeX + 4, yPos + 2);
        badgeX += badgeWidth + 4;
      });
      
      // Format type
      pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      pdf.text(`${formatFormatType(idea.formatType)}${idea.duration ? ` • ${idea.duration}s` : ''}`, badgeX + 4, yPos + 2);
      yPos += 14;
      
      // Script if exists
      if (idea.script) {
        const scriptParts = formatScript(idea.script);
        scriptParts.forEach(part => {
          if (yPos > pageHeight - 50) {
            pdf.addPage();
            pageNum++;
            addPageHeader(pageNum);
            addPageFooter();
            yPos = 35;
          }
          
          // Label
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.text(`[${part.label}]`, margin + 16, yPos);
          yPos += 5;
          
          // Content
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(textDark.r, textDark.g, textDark.b);
          const scriptLines = pdf.splitTextToSize(part.content, contentWidth - 20);
          scriptLines.forEach((line: string) => {
            if (yPos > pageHeight - 30) {
              pdf.addPage();
              pageNum++;
              addPageHeader(pageNum);
              addPageFooter();
              yPos = 35;
            }
            pdf.text(line, margin + 16, yPos);
            yPos += 5;
          });
          yPos += 3;
        });
      }
      
      // Shot list if exists
      if (idea.shotList && idea.shotList.length > 0) {
        if (yPos > pageHeight - 40) {
          pdf.addPage();
          pageNum++;
          addPageHeader(pageNum);
          addPageFooter();
          yPos = 35;
        }
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.text('SHOT LIST', margin + 16, yPos);
        yPos += 6;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(textDark.r, textDark.g, textDark.b);
        idea.shotList.forEach((shot: string) => {
          if (yPos > pageHeight - 25) {
            pdf.addPage();
            pageNum++;
            addPageHeader(pageNum);
            addPageFooter();
            yPos = 35;
          }
          pdf.text(`•  ${shot}`, margin + 20, yPos);
          yPos += 5;
        });
        yPos += 3;
      }
      
      
      // Divider line between ideas
      if (index < ideas.length - 1) {
        yPos += 5;
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 12;
      }
    });
    
    pdf.save(`${plan.title.replace(/\s+/g, '_')}_Content_Plan.pdf`);
    toast({ title: 'Downloaded!', description: 'Professional PDF saved to your downloads' });
  };

  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 pb-6">
        {/* Plan Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{clientName}</span>
            <span>•</span>
            <span>{format(new Date(plan.created_at), 'MMM d, yyyy')}</span>
          </div>
          
          {isEditingFilmingDate ? (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <Input
                type="date"
                value={editedFilmingDate}
                onChange={(e) => setEditedFilmingDate(e.target.value)}
                className="w-auto"
                autoFocus
              />
              <Button size="sm" variant="ghost" onClick={handleSaveFilmingDate}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setIsEditingFilmingDate(false);
                setEditedFilmingDate(plan.filming_date || '');
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Filming: {plan.filming_date ? format(new Date(plan.filming_date), 'MMMM d, yyyy') : 'Not set'}</span>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingFilmingDate(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          )}

        {/* Editable Title */}
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 text-lg font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                    setEditedTitle(plan.title);
                  }
                }}
              />
              <Button size="sm" variant="ghost" onClick={handleSaveTitle}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                setIsEditingTitle(false);
                setEditedTitle(plan.title);
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <h2 className="text-lg font-semibold text-foreground">{plan.title}</h2>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(true)}>
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{ideas.length} ideas</Badge>
            <Badge variant="outline">{platforms.length} platforms</Badge>
            <Badge variant="outline">{formats.length} formats</Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyAllScripts}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Scripts
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          
          {/* AI Generate Dialog */}
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Idea
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Content Idea with AI</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">What kind of content do you want?</label>
                  <Textarea
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                    placeholder="E.g., Create a viral TikTok idea about product launches, or a behind-the-scenes Instagram Reel showing our team..."
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={handleGenerateIdea} 
                  disabled={isGenerating || !generatePrompt.trim()}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Idea
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={handleAddIdea}>
            <Plus className="w-4 h-4 mr-2" />
            Add Idea
          </Button>
          {hasChanges && (
            <Button size="sm" onClick={handleSaveChanges} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>

        {/* Regenerate Dialog */}
        <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate This Idea</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">How should we improve this idea?</label>
                <Textarea
                  value={regeneratePrompt}
                  onChange={(e) => setRegeneratePrompt(e.target.value)}
                  placeholder="E.g., Make it more engaging, focus on a different angle, make the hook punchier..."
                  rows={3}
                />
              </div>
              <Button 
                onClick={() => regenerateTargetIndex !== null && handleRegenerateIdea(regenerateTargetIndex)} 
                disabled={regeneratingIndex !== null || !regeneratePrompt.trim()}
                className="w-full"
              >
                {regeneratingIndex !== null ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Agency Notes/Feedback Section */}
        <Card className="border-primary/20">
          <Collapsible open={isNotesExpanded} onOpenChange={setIsNotesExpanded}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    Your Notes & Feedback
                    {hasNotesChanges && (
                      <Badge variant="outline" className="text-xs">Unsaved</Badge>
                    )}
                  </span>
                  {isNotesExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Add your own notes or feedback about this plan before sharing with the client.
                </p>
                <Textarea
                  placeholder="Add your notes, thoughts, or internal feedback here..."
                  value={agencyNotes}
                  onChange={(e) => setAgencyNotes(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                {hasNotesChanges && (
                  <Button size="sm" onClick={handleSaveNotes} disabled={isUpdating}>
                    <Save className="w-4 h-4 mr-2" />
                    {isUpdating ? 'Saving...' : 'Save Notes'}
                  </Button>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Client Feedback Section */}
        <PlanFeedbackSection contentPlanId={plan.id} clientId={plan.client_id} />

        {/* Ideas List - grouped by category */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Content Ideas
          </h3>
          
          {(() => {
            // Group ideas by category
            const categories = [...new Set(ideas.map(i => i.category || 'Uncategorised'))];
            const hasCategories = categories.length > 1 || (categories.length === 1 && categories[0] !== 'Uncategorised');
            
            if (!hasCategories) {
              // No categories, render flat list
              return ideas.map((idea, index) => (
            <div 
              key={index} 
              draggable={editingIndex !== index}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                "border border-border rounded-lg p-4 space-y-3 transition-all",
                draggedIndex === index && "opacity-50",
                editingIndex !== index && "cursor-grab"
              )}
            >
              {editingIndex === index && editingIdea ? (
                // Editing mode
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hook / Title</label>
                    <Input
                      value={editingIdea.hook}
                      onChange={(e) => setEditingIdea({ ...editingIdea, hook: e.target.value })}
                      placeholder="Content hook or title"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Platforms</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map(p => {
                        const currentPlatforms = Array.isArray(editingIdea.platform) 
                          ? editingIdea.platform 
                          : [editingIdea.platform];
                        const isSelected = currentPlatforms.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              const platforms = isSelected
                                ? currentPlatforms.filter(x => x !== p)
                                : [...currentPlatforms, p];
                              setEditingIdea({ ...editingIdea, platform: platforms.length > 0 ? platforms : [p] });
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-sm transition-colors",
                              isSelected 
                                ? "bg-primary text-primary-foreground border-primary" 
                                : "bg-muted border-border hover:border-primary/50"
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Format</label>
                      <select
                        value={editingIdea.formatType}
                        onChange={(e) => setEditingIdea({ ...editingIdea, formatType: e.target.value })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {FORMATS.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Script</label>
                    <Textarea
                      value={editingIdea.script || ''}
                      onChange={(e) => setEditingIdea({ ...editingIdea, script: e.target.value })}
                      placeholder="[HOOK] Start with...\n[MAIN] Then explain...\n[CTA] End with..."
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use [HOOK], [MAIN], and [CTA] tags to structure your script
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Shot List</label>
                    <Textarea
                      value={(editingIdea.shotList || []).join('\n')}
                      onChange={(e) => setEditingIdea({ 
                        ...editingIdea, 
                        shotList: e.target.value.split('\n').filter(s => s.trim()) 
                      })}
                      placeholder="Enter each shot on a new line, e.g.:\nWide shot of workspace\nClose-up of product\nReaction shot..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter each shot on a new line
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Audio Suggestion</label>
                    <Input
                      value={editingIdea.audioSuggestion || ''}
                      onChange={(e) => setEditingIdea({ ...editingIdea, audioSuggestion: e.target.value })}
                      placeholder="E.g., Upbeat background music, trending audio..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration (seconds)</label>
                    <Input
                      type="number"
                      value={editingIdea.duration || 60}
                      onChange={(e) => setEditingIdea({ ...editingIdea, duration: parseInt(e.target.value) || 60 })}
                      min={15}
                      max={300}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-1">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                          {index + 1}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{idea.hook}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          {(Array.isArray(idea.platform) ? idea.platform : [idea.platform]).map((p: string) => (
                            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                          <span>{idea.formatType}</span>
                          {idea.duration && <span>• {idea.duration}s</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openRegenerateDialog(index)}
                        disabled={regeneratingIndex === index}
                        title="Regenerate with AI"
                      >
                        {regeneratingIndex === index ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(index)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteIdea(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Script */}
                  {(
                    <Collapsible open={expandedScripts[index]} onOpenChange={() => toggleScript(index)}>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between">
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Script {!idea.script && <span className="text-xs text-muted-foreground">(empty)</span>}
                          </span>
                          {expandedScripts[index] ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {editingScriptIndex === index ? (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={editingScriptValue}
                              onChange={(e) => setEditingScriptValue(e.target.value)}
                              placeholder="[HOOK] Start with...\n[MAIN] Then explain...\n[CTA] End with..."
                              rows={8}
                              className="font-mono text-sm"
                              autoFocus
                            />
                            <p className="text-xs text-muted-foreground">
                              Use [HOOK], [MAIN], and [CTA] tags to structure your script
                            </p>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveScriptEdit}>
                                <Check className="w-4 h-4 mr-1" /> Save Script
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelScriptEdit}>
                                <X className="w-4 h-4 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <div className="pl-4 border-l-2 border-primary/20">
                              {idea.script ? formatScript(idea.script).map((section, sIdx) => (
                                <div key={sIdx}>
                                  <span className="text-xs font-semibold text-muted-foreground uppercase">
                                    {section.label}
                                  </span>
                                  <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{section.content}</p>
                                </div>
                              )) : (
                                <p className="text-sm text-muted-foreground italic">No script yet</p>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => handleStartScriptEdit(index)}>
                              <Pencil className="w-4 h-4 mr-1" /> Edit Script
                            </Button>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Shot List */}
                  {idea.shotList && idea.shotList.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <ListOrdered className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <div className="text-muted-foreground">
                        {idea.shotList.join(' • ')}
                      </div>
                    </div>
                  )}

                  {/* Audio */}
                  {idea.audioSuggestion && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Music className="w-4 h-4" />
                      <span>{idea.audioSuggestion}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          ));
            }
            
            // Has categories — render grouped
            return categories.map(cat => {
              const catIdeas = ideas
                .map((idea, originalIndex) => ({ idea, originalIndex }))
                .filter(({ idea }) => (idea.category || 'Uncategorised') === cat);
              
              return (
                <div key={cat} className="space-y-3">
                  <div className="flex items-center gap-3 pt-4 pb-1">
                    <h4 className="text-base font-bold text-foreground">{cat}</h4>
                    <Badge variant="outline" className="text-xs">{catIdeas.length}</Badge>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {catIdeas.map(({ idea, originalIndex }) => (
                    <div 
                      key={originalIndex} 
                      draggable={editingIndex !== originalIndex}
                      onDragStart={() => handleDragStart(originalIndex)}
                      onDragOver={(e) => handleDragOver(e, originalIndex)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "border border-border rounded-lg p-4 space-y-3 transition-all",
                        draggedIndex === originalIndex && "opacity-50",
                        editingIndex !== originalIndex && "cursor-grab"
                      )}
                    >
                      {editingIndex === originalIndex && editingIdea ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Hook / Title</label>
                            <Input
                              value={editingIdea.hook}
                              onChange={(e) => setEditingIdea({ ...editingIdea, hook: e.target.value })}
                              placeholder="Content hook or title"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Script</label>
                            <Textarea
                              value={editingIdea.script || ''}
                              onChange={(e) => setEditingIdea({ ...editingIdea, script: e.target.value })}
                              rows={6}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit}>
                              <Check className="w-4 h-4 mr-1" /> Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                              <X className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3">
                              <div className="flex items-center gap-1">
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center">
                                  {originalIndex + 1}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{idea.hook}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                  {(Array.isArray(idea.platform) ? idea.platform : [idea.platform]).map((p: string) => (
                                    <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                                  ))}
                                  <span>{idea.formatType}</span>
                                  {idea.duration && <span>• {idea.duration}s</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRegenerateDialog(originalIndex)} disabled={regeneratingIndex === originalIndex}>
                                {regeneratingIndex === originalIndex ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(originalIndex)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteIdea(originalIndex)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {(
                            <Collapsible open={expandedScripts[originalIndex]} onOpenChange={() => toggleScript(originalIndex)}>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full justify-between">
                                  <span className="flex items-center gap-2"><FileText className="w-4 h-4" /> Script {!idea.script && <span className="text-xs text-muted-foreground">(empty)</span>}</span>
                                  {expandedScripts[originalIndex] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                {editingScriptIndex === originalIndex ? (
                                  <div className="mt-2 space-y-2">
                                    <Textarea
                                      value={editingScriptValue}
                                      onChange={(e) => setEditingScriptValue(e.target.value)}
                                      placeholder="[HOOK] Start with...\n[MAIN] Then explain...\n[CTA] End with..."
                                      rows={8}
                                      className="font-mono text-sm"
                                      autoFocus
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Use [HOOK], [MAIN], and [CTA] tags to structure your script
                                    </p>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={handleSaveScriptEdit}>
                                        <Check className="w-4 h-4 mr-1" /> Save Script
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={handleCancelScriptEdit}>
                                        <X className="w-4 h-4 mr-1" /> Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2 space-y-2">
                                    <div className="pl-4 border-l-2 border-primary/20">
                                      {idea.script ? formatScript(idea.script).map((section, sIdx) => (
                                        <div key={sIdx}>
                                          <span className="text-xs font-semibold text-muted-foreground uppercase">{section.label}</span>
                                          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{section.content}</p>
                                        </div>
                                      )) : (
                                        <p className="text-sm text-muted-foreground italic">No script yet</p>
                                      )}
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => handleStartScriptEdit(originalIndex)}>
                                      <Pencil className="w-4 h-4 mr-1" /> Edit Script
                                    </Button>
                                  </div>
                                )}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                          {idea.shotList && idea.shotList.length > 0 && (
                            <div className="flex items-start gap-2 text-sm">
                              <ListOrdered className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <div className="text-muted-foreground">{idea.shotList.join(' • ')}</div>
                            </div>
                          )}
                          {idea.audioSuggestion && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Music className="w-4 h-4" />
                              <span>{idea.audioSuggestion}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            });
          })()}

          {ideas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No content ideas yet.</p>
              <div className="flex justify-center gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setShowGenerateDialog(true)}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate with AI
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddIdea}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manually
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
