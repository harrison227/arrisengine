import React, { useState } from 'react';
import { Video, Film, Check, Trash2, Plus, Download, X, ChevronDown, ChevronUp, FileText, ListOrdered, Music } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import jsPDF from 'jspdf';

interface ContentIdea {
  hook: string;
  script?: string;
  shotList?: string[];
  audioSuggestion?: string;
  formatType: string;
  platform: string;
  trendingAngle?: string;
  duration?: number;
}

interface DraftPlan {
  contentIdeas?: ContentIdea[];
}

interface AgencySettings {
  agency_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
}

interface DraftPreviewProps {
  draftPlan: DraftPlan | null;
  onApprove?: () => void;
  isApproving?: boolean;
  onDeleteIdea?: (index: number) => void;
  onAddIdea?: (idea: ContentIdea) => void;
  clientName?: string;
  agencySettings?: AgencySettings | null;
}

const FORMAT_TYPES = [
  'Talking Head',
  'B-Roll Montage',
  'Tutorial',
  'Behind the Scenes',
  'Product Demo',
  'Testimonial',
  'Story Time',
  'Day in the Life',
];

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Instagram Stories', 'YouTube'];

// Helper to convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 30, g: 41, b: 59 }; // Slate-800
};

// Helper to format platform names for client-facing display
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

// Helper to format format types for client-facing display
const formatFormatType = (formatType: string): string => {
  const formatMap: Record<string, string> = {
    'talking_head': 'Talking Head',
    'b_roll': 'B-Roll',
    'b_roll_montage': 'B-Roll Montage',
    'voiceover': 'Voiceover',
    'interview': 'Interview',
    'tutorial': 'Tutorial',
    'behind_the_scenes': 'Behind the Scenes',
    'product_demo': 'Product Demo',
    'testimonial': 'Testimonial',
    'story_time': 'Story Time',
    'day_in_the_life': 'Day in the Life',
  };
  return formatMap[formatType.toLowerCase()] || 
    formatType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

// Helper to parse and format script sections
const formatScript = (script: string): { label: string; content: string }[] => {
  // Split by [HOOK], [MAIN], [CTA] tags
  const regex = /\[(HOOK|MAIN|CTA)\]/gi;
  const parts = script.split(regex).filter(Boolean);
  
  const result: { label: string; content: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const upperPart = part.toUpperCase();
    
    // Check if this part is a label
    if (upperPart === 'HOOK' || upperPart === 'MAIN' || upperPart === 'CTA') {
      const content = parts[i + 1]?.trim();
      if (content) {
        result.push({ label: upperPart, content });
        i++; // Skip the content part in next iteration
      }
    }
  }
  
  // If no sections found, return the whole script as a single block
  if (result.length === 0 && script.trim()) {
    return [{ label: 'SCRIPT', content: script.trim() }];
  }
  
  return result;
};

export function DraftPreview({ 
  draftPlan, 
  onApprove, 
  isApproving, 
  onDeleteIdea, 
  onAddIdea,
  clientName,
  agencySettings
}: DraftPreviewProps) {
  const [isAddingIdea, setIsAddingIdea] = useState(false);
  const [expandedScripts, setExpandedScripts] = useState<Record<number, boolean>>({});
  const [newIdea, setNewIdea] = useState<ContentIdea>({
    hook: '',
    script: '',
    formatType: '',
    platform: '',
    duration: undefined,
    trendingAngle: '',
  });

  const toggleScript = (index: number) => {
    setExpandedScripts(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleAddIdea = () => {
    if (!newIdea.hook || !newIdea.formatType || !newIdea.platform) return;
    onAddIdea?.(newIdea);
    setNewIdea({ hook: '', script: '', formatType: '', platform: '', duration: undefined, trendingAngle: '' });
    setIsAddingIdea(false);
  };

  const handleDownloadPDF = () => {
    if (!draftPlan?.contentIdeas?.length) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const contentWidth = pageWidth - margin * 2;
    
    // Professional color palette - dark grey theme
    const primaryColor = agencySettings?.primary_color 
      ? hexToRgb(agencySettings.primary_color) 
      : { r: 30, g: 41, b: 59 }; // Slate-800 (dark grey)
    const accentColor = agencySettings?.secondary_color 
      ? hexToRgb(agencySettings.secondary_color) 
      : { r: 51, g: 65, b: 85 }; // Slate-700 (dark grey accent)
    const textDark = { r: 15, g: 23, b: 42 }; // Slate 900
    const textMuted = { r: 100, g: 116, b: 139 }; // Slate 500
    const textLight = { r: 148, g: 163, b: 184 }; // Slate 400
    const borderColor = { r: 226, g: 232, b: 240 }; // Slate 200

    const agencyName = agencySettings?.agency_name || '';
    const displayClientName = clientName || 'Client';
    
    // Format date
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Stats
    const totalIdeas = draftPlan.contentIdeas.length;
    const platforms = [...new Set(draftPlan.contentIdeas.map(i => i.platform))];
    const formats = [...new Set(draftPlan.contentIdeas.map(i => i.formatType))];

    // ═══════════════════════════════════════════════════════════════
    // COVER PAGE - Clean, minimal, editorial
    // ═══════════════════════════════════════════════════════════════
    
    // Top accent line
    pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.rect(0, 0, pageWidth, 3, 'F');

    // Agency name - top left
    if (agencyName) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      pdf.text(agencyName.toUpperCase(), margin, 28);
    }

    // Date - top right
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text(formattedDate, pageWidth - margin, 28, { align: 'right' });

    // Main title block - centered
    const centerY = pageHeight * 0.42;
    
    // "CONTENT STRATEGY" - small label
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('CONTENT STRATEGY', pageWidth / 2, centerY - 30, { align: 'center' });

    // Client name - large, bold
    pdf.setFontSize(42);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(textDark.r, textDark.g, textDark.b);
    const clientNameLines = pdf.splitTextToSize(displayClientName, contentWidth - 20);
    pdf.text(clientNameLines, pageWidth / 2, centerY, { align: 'center' });

    // Thin decorative line
    const lineY = centerY + (clientNameLines.length * 16) + 12;
    pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
    pdf.setLineWidth(0.5);
    pdf.line(pageWidth / 2 - 50, lineY, pageWidth / 2 + 50, lineY);

    // Stats row - clean, no boxes
    const statsY = lineY + 40;
    const statSpacing = contentWidth / 3;
    
    // Stat 1: Ideas
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text(String(totalIdeas), margin + statSpacing * 0.5, statsY, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('CONTENT IDEAS', margin + statSpacing * 0.5, statsY + 10, { align: 'center' });

    // Stat 2: Platforms
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text(String(platforms.length), margin + statSpacing * 1.5, statsY, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('PLATFORMS', margin + statSpacing * 1.5, statsY + 10, { align: 'center' });

    // Stat 3: Formats
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text(String(formats.length), margin + statSpacing * 2.5, statsY, { align: 'center' });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('FORMATS', margin + statSpacing * 2.5, statsY + 10, { align: 'center' });

    // Platform list - subtle footer with proper formatting
    pdf.setFontSize(9);
    pdf.setTextColor(textLight.r, textLight.g, textLight.b);
    const platformList = platforms.map(p => formatPlatformName(p)).join('   ·   ');
    pdf.text(platformList, pageWidth / 2, statsY + 35, { align: 'center' });

    // Bottom accent line
    pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.rect(0, pageHeight - 3, pageWidth, 3, 'F');

    // ═══════════════════════════════════════════════════════════════
    // CONTENT PAGES - Editorial style, no boxes
    // ═══════════════════════════════════════════════════════════════
    
    const addPageHeader = () => {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(textLight.r, textLight.g, textLight.b);
      pdf.text(displayClientName.toUpperCase(), margin, 20);
      if (agencyName) {
        pdf.text(agencyName.toUpperCase(), pageWidth - margin, 20, { align: 'right' });
      }
      // Thin header line
      pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
      pdf.setLineWidth(0.3);
      pdf.line(margin, 24, pageWidth - margin, 24);
    };

    pdf.addPage();
    addPageHeader();
    let yPos = 38;

    // Section title
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    pdf.text('CONTENT IDEAS', margin, yPos);
    yPos += 18;

    // Content ideas
    draftPlan.contentIdeas.forEach((idea, index) => {
      // Calculate height for this idea
      const hookLines = pdf.splitTextToSize(`"${idea.hook}"`, contentWidth - 30);
      
      let scriptEstHeight = 0;
      if (idea.script) {
        const sections = formatScript(idea.script);
        sections.forEach(section => {
          const sectionLines = pdf.splitTextToSize(section.content, contentWidth - 18);
          scriptEstHeight += 8; // label
          scriptEstHeight += sectionLines.length * 5; // content
          scriptEstHeight += 6; // spacing
        });
      }
      
      let estimatedHeight = 35; // header area
      estimatedHeight += hookLines.length * 6;
      estimatedHeight += scriptEstHeight;
      if (idea.shotList?.length) estimatedHeight += 10 + idea.shotList.length * 5;
      if (idea.audioSuggestion || idea.trendingAngle) estimatedHeight += 8;
      estimatedHeight += 15; // bottom margin

      // Page break check
      if (yPos + Math.min(estimatedHeight, 80) > pageHeight - 30) {
        pdf.addPage();
        addPageHeader();
        yPos = 38;
      }

      // ─────────────────────────────────────────────────────
      // IDEA HEADER
      // ─────────────────────────────────────────────────────
      
      // Large number
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      const numStr = String(index + 1).padStart(2, '0');
      pdf.text(numStr, margin, yPos);
      
      // Horizontal rule after number
      pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
      pdf.setLineWidth(0.3);
      pdf.line(margin + 18, yPos - 4, pageWidth - margin, yPos - 4);
      yPos += 6;

      // Metadata line: PLATFORM · FORMAT · DURATION
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      const metaText = [
        formatPlatformName(idea.platform).toUpperCase(),
        formatFormatType(idea.formatType).toUpperCase(),
        idea.duration ? `${idea.duration} SEC` : null
      ].filter(Boolean).join('   ·   ');
      pdf.text(metaText, margin, yPos);
      yPos += 12;

      // Hook - prominent, quoted
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(textDark.r, textDark.g, textDark.b);
      hookLines.forEach((line: string) => {
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          addPageHeader();
          yPos = 38;
        }
        pdf.text(line, margin, yPos);
        yPos += 6;
      });
      yPos += 6;

      // ─────────────────────────────────────────────────────
      // SCRIPT SECTIONS with left accent border
      // ─────────────────────────────────────────────────────
      if (idea.script) {
        const scriptSections = formatScript(idea.script);
        
        scriptSections.forEach((section) => {
          const sectionLines = pdf.splitTextToSize(section.content, contentWidth - 18);
          
          // Page break if needed
          if (yPos + (sectionLines.length * 5) + 12 > pageHeight - 30) {
            pdf.addPage();
            addPageHeader();
            yPos = 38;
          }
          
          // Left accent line
          pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
          pdf.setLineWidth(2);
          const sectionHeight = 6 + sectionLines.length * 5;
          pdf.line(margin, yPos - 2, margin, yPos + sectionHeight - 4);
          
          // Section label - small caps style
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(textLight.r, textLight.g, textLight.b);
          pdf.text(section.label, margin + 6, yPos);
          yPos += 6;
          
          // Section content
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(textDark.r, textDark.g, textDark.b);
          
          sectionLines.forEach((line: string) => {
            if (yPos > pageHeight - 30) {
              pdf.addPage();
              addPageHeader();
              yPos = 38;
            }
            pdf.text(line, margin + 6, yPos);
            yPos += 5;
          });
          
          yPos += 6;
        });
      }

      // ─────────────────────────────────────────────────────
      // SHOT LIST
      // ─────────────────────────────────────────────────────
      if (idea.shotList && idea.shotList.length > 0) {
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(textLight.r, textLight.g, textLight.b);
        pdf.text('SHOTS', margin, yPos);
        yPos += 6;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(textMuted.r, textMuted.g, textMuted.b);
        idea.shotList.forEach((shot, shotIdx) => {
          if (yPos > pageHeight - 30) {
            pdf.addPage();
            addPageHeader();
            yPos = 38;
          }
          pdf.text(`${shotIdx + 1}. ${shot}`, margin + 4, yPos);
          yPos += 5;
        });
        yPos += 4;
      }

      // ─────────────────────────────────────────────────────
      // FOOTER META (Trend only - no audio)
      // ─────────────────────────────────────────────────────
      if (idea.trendingAngle) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(textLight.r, textLight.g, textLight.b);
        pdf.text(`Trend: ${idea.trendingAngle}`, margin, yPos);
        yPos += 6;
      }

      // Separator between ideas
      yPos += 8;
      if (index < draftPlan.contentIdeas.length - 1) {
        pdf.setDrawColor(borderColor.r, borderColor.g, borderColor.b);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 14;
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // PAGE FOOTERS
    // ═══════════════════════════════════════════════════════════════
    const pageCount = pdf.getNumberOfPages();
    for (let i = 2; i <= pageCount; i++) {
      pdf.setPage(i);
      
      // Bottom accent line
      pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.rect(margin, pageHeight - 12, contentWidth, 0.5, 'F');
      
      // Page number - right aligned
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(textLight.r, textLight.g, textLight.b);
      pdf.text(`${i - 1}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      
      // Document title - left aligned
      pdf.text('Content Strategy', margin, pageHeight - 8);
    }

    const fileName = `${displayClientName.replace(/\s+/g, '_')}_Content_Strategy.pdf`;
    pdf.save(fileName);
  };

  if (!draftPlan) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No plan ready yet</p>
          <p className="text-xs mt-1">Start a conversation to build your content plan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-6 py-4">
          {/* Content Ideas */}
          {draftPlan.contentIdeas && draftPlan.contentIdeas.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Video className="w-4 h-4" />
                Content Ideas ({draftPlan.contentIdeas.length})
              </h4>
              <div className="space-y-3">
                {draftPlan.contentIdeas.map((idea, index) => (
                <Card key={index} className="bg-muted/50 group relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {formatFormatType(idea.formatType)}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {formatPlatformName(idea.platform)}
                          </Badge>
                          {idea.duration && (
                            <span className="text-xs text-muted-foreground">{idea.duration}s</span>
                          )}
                          {onDeleteIdea && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => onDeleteIdea(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm font-medium text-foreground mt-2">
                        "{idea.hook}"
                      </p>

                      {/* Full Script Section */}
                      {idea.script && (
                        <Collapsible open={expandedScripts[index]} onOpenChange={() => toggleScript(index)} className="mt-3">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2 text-xs">
                              <span className="flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                View Full Script
                              </span>
                              {expandedScripts[index] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 p-4 bg-background rounded-md border space-y-4">
                              {formatScript(idea.script).map((section, idx) => (
                                <div key={idx} className="space-y-1.5">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] font-semibold ${
                                      section.label === 'HOOK' ? 'border-amber-500/50 text-amber-600 bg-amber-500/10' :
                                      section.label === 'MAIN' ? 'border-blue-500/50 text-blue-600 bg-blue-500/10' :
                                      section.label === 'CTA' ? 'border-green-500/50 text-green-600 bg-green-500/10' :
                                      ''
                                    }`}
                                  >
                                    {section.label}
                                  </Badge>
                                  <p className="text-sm text-foreground leading-relaxed pl-3 border-l-2 border-primary/30">
                                    {section.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Shot List */}
                      {idea.shotList && idea.shotList.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <ListOrdered className="w-3 h-3" />
                            Shot List
                          </p>
                          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5 pl-1">
                            {idea.shotList.map((shot, shotIdx) => (
                              <li key={shotIdx}>{shot}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Audio Suggestion */}
                      {idea.audioSuggestion && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Music className="w-3 h-3" />
                          <span className="font-medium">Audio:</span> {idea.audioSuggestion.replace('_', ' ')}
                        </div>
                      )}
                      
                      {idea.trendingAngle && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <span className="font-medium">Trending:</span> {idea.trendingAngle}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Add Idea Form */}
          {onAddIdea && (
            <div>
              {isAddingIdea ? (
                <Card className="border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <Input
                      placeholder="What's the content hook?"
                      value={newIdea.hook}
                      onChange={(e) => setNewIdea({ ...newIdea, hook: e.target.value })}
                    />
                    <Textarea
                      placeholder="Full script (optional) - Include [HOOK], [MAIN], [CTA] sections..."
                      value={newIdea.script || ''}
                      onChange={(e) => setNewIdea({ ...newIdea, script: e.target.value })}
                      className="min-h-[80px] text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={newIdea.formatType}
                        onValueChange={(value) => setNewIdea({ ...newIdea, formatType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Format type" />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMAT_TYPES.map((format) => (
                            <SelectItem key={format} value={format}>
                              {format}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={newIdea.platform}
                        onValueChange={(value) => setNewIdea({ ...newIdea, platform: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              {platform}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Duration (seconds)"
                        value={newIdea.duration || ''}
                        onChange={(e) => setNewIdea({ ...newIdea, duration: e.target.value ? parseInt(e.target.value) : undefined })}
                      />
                      <Input
                        placeholder="Trending angle (optional)"
                        value={newIdea.trendingAngle || ''}
                        onChange={(e) => setNewIdea({ ...newIdea, trendingAngle: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsAddingIdea(false)}>
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleAddIdea}
                        disabled={!newIdea.hook || !newIdea.formatType || !newIdea.platform}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Idea
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setIsAddingIdea(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Custom Idea
                </Button>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="flex-shrink-0 pt-4 border-t border-border space-y-2">
        {draftPlan.contentIdeas && draftPlan.contentIdeas.length > 0 && (
          <Button variant="outline" onClick={handleDownloadPDF} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        )}
        {onApprove && (
          <Button onClick={onApprove} disabled={isApproving} className="w-full">
            <Check className="w-4 h-4 mr-2" />
            Approve & Create
          </Button>
        )}
      </div>
    </div>
  );
}