import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface KnowledgeSummary {
  positioning_summary?: string | null;
  ideal_customer_profile?: string | null;
  key_differentiators?: string[] | null;
  content_opportunities?: string[] | null;
  compliance_flags?: string[] | null;
}

interface KnowledgePdfOptions {
  clientName: string;
  agencyName?: string;
  entries: KnowledgeEntry[];
  summary?: KnowledgeSummary | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  brand: 'Brand',
  audience: 'Audience',
  competitors: 'Competitors',
  offers: 'Offers',
  past_results: 'Past Results',
  notes: 'Notes',
  compliance: 'Compliance',
};

const CATEGORY_ORDER = ['brand', 'audience', 'competitors', 'offers', 'past_results', 'notes', 'compliance'];

export async function generateKnowledgePdf(options: KnowledgePdfOptions): Promise<void> {
  const { clientName, agencyName = 'Agency', entries, summary } = options;

  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - (margin * 2);

  // Brand colors
  const primaryColor = { r: 30, g: 41, b: 59 }; // Slate 800
  const accentColor = { r: 51, g: 65, b: 85 }; // Slate 700
  const textColor = { r: 30, g: 41, b: 59 }; // Slate 800
  const mutedColor = { r: 100, g: 116, b: 139 }; // Slate 500

  let pageNumber = 1;

  // Helper to add page header
  const addPageHeader = () => {
    pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.setLineWidth(0.5);
    pdf.line(margin, 15, pageWidth - margin, 15);
    
    pdf.setFontSize(8);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.setFont('helvetica', 'normal');
    
    const truncatedName = clientName.length > 40 ? clientName.substring(0, 37) + '...' : clientName;
    pdf.text(`${truncatedName} - Knowledge Base`, margin, 12);
    pdf.text(`Page ${pageNumber}`, pageWidth - margin - 15, 12);
  };

  // Helper to add page footer
  const addPageFooter = () => {
    pdf.setFontSize(7);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.text('Confidential', margin, pageHeight - 10);
    pdf.text(agencyName, pageWidth - margin - 20, pageHeight - 10);
  };

  // Helper for wrapped text with page handling
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 5, fontSize: number = 10): number => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > pageHeight - 30) {
        addPageFooter();
        pdf.addPage();
        pageNumber++;
        addPageHeader();
        y = 35;
      }
      pdf.text(line, x, y);
      y += lineHeight;
    }
    return y;
  };

  // Check if we need a new page
  const checkPageBreak = (y: number, neededSpace: number = 30): number => {
    if (y > pageHeight - neededSpace) {
      addPageFooter();
      pdf.addPage();
      pageNumber++;
      addPageHeader();
      return 35;
    }
    return y;
  };

  // ========== COVER PAGE ==========
  
  // Background
  pdf.setFillColor(250, 251, 252);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Top accent bar
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.rect(0, 0, pageWidth, 10, 'F');
  
  // Secondary accent line
  pdf.setFillColor(accentColor.r, accentColor.g, accentColor.b);
  pdf.rect(0, 10, pageWidth, 2, 'F');
  
  // Agency name at top
  let coverY = 50;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.text(agencyName.toUpperCase(), margin, coverY);
  
  // Client name
  coverY = 90;
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  const titleLines = pdf.splitTextToSize(clientName.toUpperCase(), contentWidth);
  for (const line of titleLines) {
    pdf.text(line, margin, coverY);
    coverY += 12;
  }
  
  // Report title
  coverY += 5;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b);
  pdf.text('Knowledge Base Report', margin, coverY);
  
  // Decorative line
  coverY += 10;
  pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
  pdf.setLineWidth(2);
  pdf.line(margin, coverY, margin + 60, coverY);
  
  // Stats summary
  coverY += 25;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  pdf.text(`Total Entries: ${entries.length}`, margin, coverY);
  coverY += 8;
  pdf.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, margin, coverY);

  // Category breakdown
  coverY += 20;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  pdf.text('Entries by Category:', margin, coverY);
  
  coverY += 10;
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  
  for (const category of CATEGORY_ORDER) {
    const count = entries.filter(e => e.category === category).length;
    if (count > 0) {
      pdf.text(`• ${CATEGORY_LABELS[category]}: ${count}`, margin + 5, coverY);
      coverY += 7;
    }
  }
  
  // Bottom accent bar
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.rect(0, pageHeight - 10, pageWidth, 10, 'F');

  // ========== AI SUMMARY PAGE ==========
  if (summary && (summary.positioning_summary || summary.ideal_customer_profile || 
      (summary.key_differentiators && summary.key_differentiators.length > 0) ||
      (summary.content_opportunities && summary.content_opportunities.length > 0) ||
      (summary.compliance_flags && summary.compliance_flags.length > 0))) {
    
    pdf.addPage();
    pageNumber++;
    addPageHeader();
    
    let y = 35;
    
    // Section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text('AI ANALYSIS SUMMARY', margin, y);
    
    y += 5;
    pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
    pdf.setLineWidth(1);
    pdf.line(margin, y, margin + 50, y);
    
    y += 15;
    
    // Positioning Summary
    if (summary.positioning_summary) {
      y = checkPageBreak(y, 40);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      pdf.text('Positioning', margin, y);
      y += 7;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      y = addWrappedText(summary.positioning_summary, margin, y, contentWidth, 5, 10);
      y += 10;
    }
    
    // Ideal Customer Profile
    if (summary.ideal_customer_profile) {
      y = checkPageBreak(y, 40);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      pdf.text('Ideal Customer Profile', margin, y);
      y += 7;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      y = addWrappedText(summary.ideal_customer_profile, margin, y, contentWidth, 5, 10);
      y += 10;
    }
    
    // Key Differentiators
    if (summary.key_differentiators && summary.key_differentiators.length > 0) {
      y = checkPageBreak(y, 40);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      pdf.text('Key Differentiators', margin, y);
      y += 7;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      
      for (const diff of summary.key_differentiators) {
        y = checkPageBreak(y, 15);
        y = addWrappedText(`• ${diff}`, margin + 5, y, contentWidth - 5, 5, 10);
        y += 2;
      }
      y += 8;
    }
    
    // Content Opportunities
    if (summary.content_opportunities && summary.content_opportunities.length > 0) {
      y = checkPageBreak(y, 40);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      pdf.text('Content Opportunities', margin, y);
      y += 7;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      
      for (const opp of summary.content_opportunities) {
        y = checkPageBreak(y, 15);
        y = addWrappedText(`• ${opp}`, margin + 5, y, contentWidth - 5, 5, 10);
        y += 2;
      }
      y += 8;
    }
    
    // Compliance Flags
    if (summary.compliance_flags && summary.compliance_flags.length > 0) {
      y = checkPageBreak(y, 40);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      pdf.text('Compliance Notes', margin, y);
      y += 7;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      for (const flag of summary.compliance_flags) {
        y = checkPageBreak(y, 15);
        pdf.setTextColor(180, 100, 50); // Warning orange
        y = addWrappedText(`⚠ ${flag}`, margin + 5, y, contentWidth - 5, 5, 10);
        y += 2;
      }
    }
    
    addPageFooter();
  }

  // ========== KNOWLEDGE ENTRIES ==========
  pdf.addPage();
  pageNumber++;
  addPageHeader();
  
  let y = 35;
  
  // Section title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.text('KNOWLEDGE ENTRIES', margin, y);
  
  y += 5;
  pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
  pdf.setLineWidth(1);
  pdf.line(margin, y, margin + 50, y);
  
  y += 15;
  
  // Group entries by category
  for (const category of CATEGORY_ORDER) {
    const categoryEntries = entries.filter(e => e.category === category);
    
    if (categoryEntries.length === 0) continue;
    
    // Category header
    y = checkPageBreak(y, 50);
    
    pdf.setFillColor(245, 247, 250);
    pdf.rect(margin - 3, y - 6, contentWidth + 6, 12, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.text(`■ ${CATEGORY_LABELS[category].toUpperCase()}`, margin, y);
    
    y += 15;
    
    // Entries
    for (const entry of categoryEntries) {
      y = checkPageBreak(y, 40);
      
      // Entry title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      pdf.text(entry.title, margin, y);
      y += 6;
      
      // Entry content
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      y = addWrappedText(entry.content, margin, y, contentWidth, 4.5, 9);
      
      // Separator
      y += 8;
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.3);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 10;
    }
    
    y += 5;
  }
  
  addPageFooter();
  
  // Download the PDF
  const fileName = `${clientName.toLowerCase().replace(/\s+/g, '-')}-knowledge-base-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  pdf.save(fileName);
}
