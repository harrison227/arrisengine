import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, FileText, Building2, User, Mail, Globe, DollarSign, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useClient } from '@/hooks/useClients';
import { useKnowledgeSummary } from '@/hooks/useKnowledgeSummary';
import { useAgencySettings } from '@/hooks/useAgencySettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { OnboardingConfigDialog, OnboardingConfig } from '@/components/dialogs/OnboardingConfigDialog';
// jsPDF is dynamically imported inside downloadPDF — keeps it out of the main bundle.

// Response shape from the generate-onboarding-pdf edge function.
interface OnboardingPdfData {
  success: boolean;
  client: {
    id: string;
    business_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    industry: string | null;
    mrr: number | null;
    status: string;
  };
  knowledgeSummary: {
    positioning_summary: string | null;
    key_differentiators: string[];
    content_opportunities: string[];
    compliance_flags: string[];
    ideal_customer_profile: string | null;
  } | null;
  agencySettings: {
    agency_name: string | null;
    logo_url: string | null;
    primary_color: string | null;
  } | null;
  config: {
    platforms: Record<string, boolean>;
    assetNeeds: Record<string, boolean>;
    customNote: string;
  };
  generatedAt: string;
  error?: string;
}

// Helper to convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const defaultColor = { r: 124, g: 58, b: 237 }; // Default violet
  if (!hex || !hex.startsWith('#')) return defaultColor;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : defaultColor;
};


// Helper to load image as base64
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

export default function Onboarding() {
  const { id } = useParams<{ id: string }>();
  const { data: client, isLoading: clientLoading } = useClient(id);
  const { summary: knowledgeSummary } = useKnowledgeSummary(id || '');
  const { settings: agencySettings } = useAgencySettings();
  const { toast } = useToast();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const generatePacket = async (config: OnboardingConfig) => {
    if (!id || !client) return;
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-onboarding-pdf', {
        body: { 
          clientId: id,
          platforms: config.platforms,
          assetNeeds: config.assetNeeds,
          customNote: config.customNote,
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to generate content');
      }

      // Close dialog BEFORE PDF generation to release scroll lock
      setIsConfigOpen(false);
      setIsGenerating(false);

      // Small delay to let dialog close animation complete before PDF generation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate and download PDF
      await downloadPDF(data, config);

      toast({
        title: 'Onboarding Packet Generated',
        description: `${client.business_name}_Official_Onboarding_Packet.pdf has been downloaded`,
      });
    } catch (error) {
      toast({
        title: 'Error generating packet',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setIsGenerating(false);
      setIsConfigOpen(false);
    }
  };

  const downloadPDF = async (data: OnboardingPdfData, config: OnboardingConfig) => {
    if (!client) return;

    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = 0;

    // Clean minimal color palette
    const primaryColor = hexToRgb(agencySettings?.primary_color || '#7C3AED');
    const agencyName = agencySettings?.agency_name || 'Your Agency';

    // Load agency logo if available
    let logoBase64: string | null = null;
    if (agencySettings?.logo_url) {
      logoBase64 = await loadImageAsBase64(agencySettings.logo_url);
    }

    // Load cover image
    let coverImageBase64: string | null = null;
    try {
      coverImageBase64 = await loadImageAsBase64('/onboarding-cover.png');
    } catch (e) {
      console.log('Cover image not found');
    }

    // Helper functions
    const addPage = () => {
      pdf.addPage();
      yPos = margin + 10;
    };

    const checkPageBreak = (neededSpace: number) => {
      if (yPos + neededSpace > pageHeight - 25) {
        addPage();
      }
    };

    // Minimal page header
    const addPageHeader = (title: string) => {
      pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.rect(0, 0, pageWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.text(agencyName.toUpperCase(), margin, 5.5);
      pdf.setFont('helvetica', 'normal');
      pdf.text(title, pageWidth - margin, 5.5, { align: 'right' });
    };

    // Section title with left accent
    const addSectionTitle = (title: string) => {
      checkPageBreak(20);
      pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.rect(margin, yPos, 2, 10, 'F');
      pdf.setTextColor(40, 40, 40);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin + 8, yPos + 7);
      yPos += 16;
    };

    // ==================== COVER PAGE ====================
    // Cover image as hero - full width at top
    if (coverImageBase64) {
      try {
        const imgWidth = pageWidth;
        const imgHeight = pageHeight * 0.55;
        pdf.addImage(coverImageBase64, 'PNG', 0, 0, imgWidth, imgHeight);
      } catch (e) {
        console.log('Failed to add cover image');
      }
    }

    // Content area below image
    const contentStartY = coverImageBase64 ? pageHeight * 0.55 + 10 : 60;
    yPos = contentStartY;

    // Agency logo (small, centered)
    if (logoBase64) {
      try {
        pdf.addImage(logoBase64, 'PNG', pageWidth / 2 - 12, yPos, 24, 24);
        yPos += 30;
      } catch (e) {
        pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(agencyName, pageWidth / 2, yPos + 10, { align: 'center' });
        yPos += 20;
      }
    } else {
      pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(agencyName, pageWidth / 2, yPos + 5, { align: 'center' });
      yPos += 15;
    }

    // Title
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Onboarding Packet', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    // Client name
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.text(client.business_name, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Date
    pdf.setTextColor(120, 120, 120);
    pdf.setFontSize(10);
    pdf.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth / 2, yPos, { align: 'center' });

    // Custom note on cover
    if (config.customNote) {
      yPos += 15;
      pdf.setFillColor(250, 250, 250);
      pdf.roundedRect(margin + 10, yPos, contentWidth - 20, 25, 2, 2, 'F');
      pdf.setTextColor(80, 80, 80);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      const noteLines = pdf.splitTextToSize(config.customNote, contentWidth - 35);
      pdf.text(noteLines.slice(0, 2), margin + 18, yPos + 10);
    }

    // ==================== PLATFORM SETUP PAGE ====================
    const selectedPlatforms = Object.entries(config.platforms).filter(([_, selected]) => selected);
    
    if (selectedPlatforms.length > 0) {
      addPage();
      addPageHeader('Platform Setup');

      yPos = 18;
      addSectionTitle('Platform Access Instructions');
      
      pdf.setTextColor(80, 80, 80);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Complete these steps to grant access to your advertising accounts.', margin, yPos);
      yPos += 10;

      const platformInstructions: Record<string, { title: string; steps: string[] }> = {
        facebook: {
          title: 'Facebook & Instagram Ads',
          steps: [
            'Go to business.facebook.com > Business Settings',
            'Click "Partners" under Users section',
            'Click "Add" and enter our Business ID',
            'Grant "Manage campaigns" and "View performance" permissions',
            'Ensure Meta Pixel is installed on your website',
          ],
        },
        tiktok: {
          title: 'TikTok Ads',
          steps: [
            'Log into TikTok Business Center',
            'Go to Settings > Members',
            'Click "Invite Member" and enter our email',
            'Assign "Admin" role for campaign management',
          ],
        },
        google: {
          title: 'Google Ads',
          steps: [
            'Sign into Google Ads at ads.google.com',
            'Click Tools icon > Access and security',
            'Click "+" to add a new user',
            'Enter our email and select "Admin" access',
          ],
        },
        youtube: {
          title: 'YouTube',
          steps: [
            'Go to YouTube Studio for your channel',
            'Click Settings > Permissions',
            'Click "Invite" and enter our email',
            'Grant "Editor" permissions',
          ],
        },
        instagram: {
          title: 'Instagram (Organic)',
          steps: [
            'Ensure your account is a Business account',
            'Connect to your Facebook Page',
            'Approve access request via Meta Business Suite',
          ],
        },
      };

      for (const [platform, selected] of selectedPlatforms) {
        if (!selected) continue;
        const info = platformInstructions[platform];
        if (!info) continue;

        checkPageBreak(40);

        // Platform card - minimal white card with subtle border
        const cardHeight = 10 + info.steps.length * 6;
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, yPos, contentWidth, cardHeight, 2, 2, 'S');
        
        // Platform title
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(info.title, margin + 6, yPos + 7);
        yPos += 12;

        // Steps
        pdf.setTextColor(60, 60, 60);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        
        for (const step of info.steps) {
          checkPageBreak(7);
          pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
          pdf.circle(margin + 8, yPos - 1, 1, 'F');
          const stepLines = pdf.splitTextToSize(step, contentWidth - 20);
          pdf.text(stepLines, margin + 14, yPos);
          yPos += stepLines.length * 4 + 2;
        }
        
        yPos += 8;
      }
    }

    // ==================== ASSET REQUIREMENTS PAGE ====================
    const selectedAssets = Object.entries(config.assetNeeds).filter(([_, selected]) => selected);
    
    if (selectedAssets.length > 0) {
      addPage();
      addPageHeader('Asset Requirements');

      yPos = 18;
      addSectionTitle('What We Need From You');
      
      pdf.setTextColor(80, 80, 80);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Please provide the following materials for production.', margin, yPos);
      yPos += 10;

      const assetDetails: Record<string, { title: string; items: string[] }> = {
        rawFootage: {
          title: 'Raw Footage & Photos',
          items: [
            'Video: MP4 or MOV, 1080p minimum',
            'Photos: JPG or PNG, high resolution',
            'Share via Google Drive, Dropbox, or WeTransfer',
            'Include B-roll and product shots',
          ],
        },
        productShipment: {
          title: 'Product Shipment',
          items: [
            'Ship 2-3 units of each product',
            'Include packaging and inserts',
            'Shipping address provided separately',
          ],
        },
        brandAssets: {
          title: 'Brand Assets',
          items: [
            'Logo: Vector (AI, EPS, SVG) + PNG',
            'Brand colors: Hex codes',
            'Typography: Font files or names',
            'Brand guidelines if available',
          ],
        },
        ugc: {
          title: 'User-Generated Content',
          items: [
            'Customer testimonials',
            'Positive social media mentions',
            'Before/after photos if applicable',
          ],
        },
      };

      for (const [asset, selected] of selectedAssets) {
        if (!selected) continue;
        const info = assetDetails[asset];
        if (!info) continue;

        checkPageBreak(35);

        // Asset card
        const cardHeight = 10 + info.items.length * 6;
        pdf.setFillColor(252, 252, 252);
        pdf.roundedRect(margin, yPos, contentWidth, cardHeight, 2, 2, 'F');
        pdf.setDrawColor(230, 230, 230);
        pdf.roundedRect(margin, yPos, contentWidth, cardHeight, 2, 2, 'S');
        
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(info.title, margin + 6, yPos + 7);
        yPos += 12;

        pdf.setTextColor(60, 60, 60);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        
        for (const item of info.items) {
          checkPageBreak(7);
          pdf.text('-', margin + 8, yPos);
          const itemLines = pdf.splitTextToSize(item, contentWidth - 20);
          pdf.text(itemLines, margin + 14, yPos);
          yPos += itemLines.length * 4 + 2;
        }
        
        yPos += 8;
      }
    }

    // ==================== STRATEGY INSIGHTS PAGE ====================
    if (data.knowledgeSummary) {
      addPage();
      addPageHeader('Strategy Insights');

      yPos = 18;
      addSectionTitle('What We Know About Your Brand');

      const summary = data.knowledgeSummary;

      // Positioning Summary
      if (summary.positioning_summary) {
        checkPageBreak(35);
        
        pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Brand Positioning', margin, yPos);
        yPos += 6;
        
        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const posLines = pdf.splitTextToSize(summary.positioning_summary, contentWidth);
        pdf.text(posLines.slice(0, 4), margin, yPos);
        yPos += posLines.slice(0, 4).length * 5 + 10;
      }

      // Key Differentiators
      if (summary.key_differentiators?.length > 0) {
        checkPageBreak(40);
        
        pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Key Differentiators', margin, yPos);
        yPos += 6;

        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        for (const diff of summary.key_differentiators.slice(0, 5)) {
          checkPageBreak(8);
          pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
          pdf.circle(margin + 2, yPos - 1, 1, 'F');
          const diffLines = pdf.splitTextToSize(diff, contentWidth - 10);
          pdf.text(diffLines, margin + 8, yPos);
          yPos += diffLines.length * 4 + 3;
        }
        yPos += 6;
      }

      // Ideal Customer Profile
      if (summary.ideal_customer_profile) {
        checkPageBreak(35);
        
        pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Ideal Customer Profile', margin, yPos);
        yPos += 6;
        
        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const icpLines = pdf.splitTextToSize(summary.ideal_customer_profile, contentWidth);
        pdf.text(icpLines.slice(0, 4), margin, yPos);
        yPos += icpLines.slice(0, 4).length * 5 + 10;
      }

      // Content Opportunities
      if (summary.content_opportunities?.length > 0) {
        checkPageBreak(40);
        
        pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Content Opportunities', margin, yPos);
        yPos += 6;

        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        
        for (const opp of summary.content_opportunities.slice(0, 5)) {
          checkPageBreak(8);
          pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
          pdf.circle(margin + 2, yPos - 1, 1, 'F');
          const oppLines = pdf.splitTextToSize(opp, contentWidth - 10);
          pdf.text(oppLines, margin + 8, yPos);
          yPos += oppLines.length * 4 + 3;
        }
      }
    }

    // ==================== CONTACT SECTION (on last page, not separate) ====================
    yPos += 15;
    checkPageBreak(35);

    pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Questions?', margin + 10, yPos + 12);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Reach out anytime - we typically respond within 24 hours.', margin + 10, yPos + 20);
    pdf.text(agencySettings?.default_email_signature || agencyName, margin + 10, yPos + 26);

    // ==================== FOOTER ON ALL PAGES ====================
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      
      if (i > 1) {
        pdf.text(`${client.business_name}`, margin, pageHeight - 8);
      }
      pdf.text(`${i} / ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    // Save
    const filename = `${client.business_name.replace(/[^a-zA-Z0-9]/g, '_')}_Onboarding_Packet.pdf`;
    pdf.save(filename);
  };

  if (clientLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-12 w-64 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to={`/clients/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Client Onboarding</h1>
            <p className="text-muted-foreground">Generate onboarding packet for {client?.business_name}</p>
          </div>
        </div>
      </div>

      {/* Client Overview Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Client Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4" />
                Business
              </div>
              <p className="font-medium">{client?.business_name}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                Contact
              </div>
              <p className="font-medium">{client?.contact_name}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                Email
              </div>
              <p className="font-medium text-sm">{client?.email}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                MRR
              </div>
              <p className="font-medium">${client?.mrr?.toLocaleString()}/mo</p>
            </div>
          </div>
          {client?.website && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Globe className="w-4 h-4" />
                Website
              </div>
              <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {client.website}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Knowledge Summary Preview */}
      {knowledgeSummary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Strategy Summary
              <Badge variant="secondary" className="ml-2">Will be included in packet</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {knowledgeSummary.positioning_summary && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Positioning</h4>
                <p className="text-sm">{knowledgeSummary.positioning_summary}</p>
              </div>
            )}
            {knowledgeSummary.key_differentiators && knowledgeSummary.key_differentiators.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Key Differentiators</h4>
                <div className="flex flex-wrap gap-2">
                  {knowledgeSummary.key_differentiators.map((diff, i) => (
                    <Badge key={i} variant="outline">{diff}</Badge>
                  ))}
                </div>
              </div>
            )}
            {knowledgeSummary.ideal_customer_profile && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Ideal Customer</h4>
                <p className="text-sm">{knowledgeSummary.ideal_customer_profile}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="p-8">
          <div ref={contentRef} className="text-center space-y-4">
            <FileText className="w-16 h-16 text-primary mx-auto" />
            <div>
              <h3 className="text-xl font-semibold">Ready to Generate Onboarding Packet</h3>
              <p className="text-muted-foreground mt-1">
                Configure platforms, asset requirements, and add a personal note
              </p>
            </div>
            <Button size="lg" onClick={() => setIsConfigOpen(true)} className="mt-4">
              <Download className="w-4 h-4 mr-2" />
              Generate Onboarding Packet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <OnboardingConfigDialog
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        onGenerate={generatePacket}
        isGenerating={isGenerating}
        clientName={client?.business_name}
      />
    </div>
  );
}
