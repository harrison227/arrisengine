import jsPDF from 'jspdf';
import { format } from 'date-fns';

// Contract type definitions
interface Contract {
  id: string;
  title: string;
  content: string;
  contract_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  version: number;
  created_at: string;
}

interface Client {
  business_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
}

interface ContractSignatureData {
  signer_name: string;
  signer_title?: string;
  signature_data: string;
  signed_at: string;
}

interface ContractPdfOptions {
  agencyName?: string;
  agencyContactName?: string;
  agencyEmail?: string;
  agencyPhone?: string;
  agencySignature?: ContractSignatureData;
  clientSignature?: ContractSignatureData;
}

const CONTRACT_TYPES: Record<string, string> = {
  retainer: 'Monthly Retainer',
  project: 'Project-Based',
  'one-off': 'One-Off Service',
  consulting: 'Consulting Agreement',
};

// Sanitize content - strip any remaining markdown
const sanitizeContent = (text: string): string => {
  return text
    .replace(/\*\*/g, '')           // Remove ** bold
    .replace(/\*/g, '')             // Remove * italic
    .replace(/^#+\s*/gm, '')        // Remove # headings
    .replace(/`([^`]+)`/g, '$1')    // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/_{2,}/g, '_')         // Normalize underscores
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove links
};

/**
 * Generate a PDF blob for a contract
 */
export async function generateContractPdfBlob(
  contract: Contract,
  client?: Client | null,
  options: ContractPdfOptions = {}
): Promise<Blob> {
  const {
    agencyName = 'Arris Studios',
    agencyContactName = '',
    agencyEmail = '',
    agencyPhone = '',
    agencySignature,
    clientSignature,
  } = options;

  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - (margin * 2);
  
  // Sanitize the content before rendering
  const cleanContent = sanitizeContent(contract.content);
  
  // Brand colors - Dark grey theme
  const primaryColor = { r: 30, g: 41, b: 59 }; // Slate 800
  const accentColor = { r: 51, g: 65, b: 85 }; // Slate 700
  const textColor = { r: 30, g: 41, b: 59 }; // Slate 800
  const mutedColor = { r: 100, g: 116, b: 139 }; // Slate 500
  
  // Helper function to add text with wrapping and page handling
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 6, fontSize: number = 10): number => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > pageHeight - 40) {
        pdf.addPage();
        addPageHeader();
        y = 45;
      }
      pdf.text(line, x, y);
      y += lineHeight;
    }
    return y;
  };
  
  // Page header for content pages
  const addPageHeader = () => {
    // Top line
    pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.setLineWidth(0.5);
    pdf.line(margin, 15, pageWidth - margin, 15);
    
    // Header text
    pdf.setFontSize(8);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.setFont('helvetica', 'normal');
    
    const truncatedTitle = contract.title.length > 50 ? contract.title.substring(0, 47) + '...' : contract.title;
    pdf.text(truncatedTitle, margin, 12);
    pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin - 15, 12);
  };
  
  // Page footer
  const addPageFooter = () => {
    pdf.setFontSize(7);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.text('Confidential', margin, pageHeight - 10);
    pdf.text(agencyName, pageWidth - margin - 30, pageHeight - 10);
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
  
  // Contract Title
  coverY = 90;
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  const titleLines = pdf.splitTextToSize(contract.title.toUpperCase(), contentWidth);
  for (const line of titleLines) {
    pdf.text(line, margin, coverY);
    coverY += 12;
  }
  
  // Decorative line under title
  coverY += 5;
  pdf.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
  pdf.setLineWidth(2);
  pdf.line(margin, coverY, margin + 60, coverY);
  
  // Contract metadata
  coverY += 20;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  
  const contractTypeLabel = CONTRACT_TYPES[contract.contract_type || ''] || 'Service Agreement';
  pdf.text(contractTypeLabel, margin, coverY);
  coverY += 8;
  
  if (contract.start_date) {
    const periodText = contract.end_date 
      ? `${format(new Date(contract.start_date), 'MMMM d, yyyy')} — ${format(new Date(contract.end_date), 'MMMM d, yyyy')}`
      : `Effective ${format(new Date(contract.start_date), 'MMMM d, yyyy')}`;
    pdf.text(periodText, margin, coverY);
    coverY += 8;
  }
  
  pdf.text(`Version ${contract.version}`, margin, coverY);
  
  // PARTIES SECTION
  coverY = 150;
  
  // Divider
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, coverY, pageWidth - margin, coverY);
  
  coverY += 20;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.text('BETWEEN THE PARTIES', margin, coverY);
  
  coverY += 15;
  
  // Two-column party info
  const colWidth = (contentWidth - 20) / 2;
  
  // Provider column
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  pdf.text('THE PROVIDER', margin, coverY);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  let providerY = coverY + 8;
  pdf.setFontSize(11);
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  pdf.text(agencyName, margin, providerY);
  providerY += 7;
  
  pdf.setFontSize(9);
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  if (agencyContactName) {
    pdf.text(`Contact: ${agencyContactName}`, margin, providerY);
    providerY += 6;
  }
  if (agencyEmail) {
    pdf.text(`Email: ${agencyEmail}`, margin, providerY);
    providerY += 6;
  }
  if (agencyPhone) {
    pdf.text(`Phone: ${agencyPhone}`, margin, providerY);
  }
  
  // Client column
  const rightColX = margin + colWidth + 20;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  pdf.text('THE CLIENT', rightColX, coverY);
  
  let clientY = coverY + 8;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(client?.business_name || '[Client Name]', rightColX, clientY);
  clientY += 7;
  
  pdf.setFontSize(9);
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  if (client?.contact_name) {
    pdf.text(`Contact: ${client.contact_name}`, rightColX, clientY);
    clientY += 6;
  }
  if (client?.email) {
    pdf.text(`Email: ${client.email}`, rightColX, clientY);
    clientY += 6;
  }
  if (client?.phone) {
    pdf.text(`Phone: ${client.phone}`, rightColX, clientY);
  }
  
  // Footer on cover
  pdf.setFontSize(8);
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  pdf.text(`Prepared on ${format(new Date(contract.created_at), 'MMMM d, yyyy')}`, margin, pageHeight - 25);
  
  // Bottom accent bar
  pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.rect(0, pageHeight - 10, pageWidth, 10, 'F');
  
  // ========== CONTENT PAGES ==========
  pdf.addPage();
  addPageHeader();
  
  let y = 45;
  
  // Process content line by line
  const contentLines = cleanContent.split('\n');
  
  for (const line of contentLines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines but add spacing
    if (!trimmedLine) {
      y += 4;
      continue;
    }
    
    // Check for page break needed
    if (y > pageHeight - 50) {
      addPageFooter();
      pdf.addPage();
      addPageHeader();
      y = 45;
    }
    
    // Detect section headers (numbered sections starting with uppercase or all caps)
    const isMainSection = /^[0-9]+\.\s+[A-Z]/.test(trimmedLine);
    const isAllCapsHeader = /^[A-Z][A-Z\s]{3,}$/.test(trimmedLine) && trimmedLine.length < 60;
    
    if (isMainSection || isAllCapsHeader) {
      // Main section heading
      y += 6; // Extra space before
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      y = addWrappedText(trimmedLine, margin, y, contentWidth, 7, 12);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      y += 3; // Space after heading
    }
    // Sub-sections (1.1, 1.2, etc.)
    else if (/^[0-9]+\.[0-9]+/.test(trimmedLine)) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      y = addWrappedText(trimmedLine, margin + 5, y, contentWidth - 5, 6, 10);
      pdf.setFont('helvetica', 'normal');
      y += 2;
    }
    // Lettered items (a), (b), etc.
    else if (/^\([a-z]\)/.test(trimmedLine)) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      y = addWrappedText(trimmedLine, margin + 12, y, contentWidth - 12, 5.5, 10);
    }
    // Bullet points
    else if (/^[-•]/.test(trimmedLine)) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      const bulletText = trimmedLine.replace(/^[-•]\s*/, '• ');
      y = addWrappedText(bulletText, margin + 8, y, contentWidth - 8, 5.5, 10);
    }
    // Definition style (Term: definition)
    else if (/^"[^"]+":/.test(trimmedLine) || /^[A-Z][a-z]+:/.test(trimmedLine)) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      y = addWrappedText(trimmedLine, margin + 5, y, contentWidth - 5, 5.5, 10);
    }
    // Regular paragraph
    else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(textColor.r, textColor.g, textColor.b);
      y = addWrappedText(trimmedLine, margin, y, contentWidth, 5.5, 10);
    }
  }
  
  // ========== SIGNATURE PAGE ==========
  if (y > pageHeight - 120) {
    addPageFooter();
    pdf.addPage();
    addPageHeader();
    y = 45;
  }
  
  y += 15;
  
  // Signature section divider
  pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.setLineWidth(1);
  pdf.line(margin, y, pageWidth - margin, y);
  
  y += 15;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  pdf.text('SIGNATURES', margin, y);
  
  y += 8;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
  pdf.text('By signing below, the parties agree to all terms and conditions set forth in this Agreement.', margin, y);
  
  y += 20;
  
  // Two-column signature layout
  const sigColWidth = (contentWidth - 30) / 2;
  
  // Provider signature block
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  pdf.text('FOR THE PROVIDER', margin, y);
  
  let sigY = y + 12;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(agencyName, margin, sigY);
  
  sigY += 8;
  
  if (agencySignature?.signature_data) {
    // Add signature image
    try {
      pdf.addImage(agencySignature.signature_data, 'PNG', margin, sigY, 50, 18);
    } catch (e) {
      // Fallback if image fails
    }
    sigY += 20;
    
    // Signature line
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.5);
    pdf.line(margin, sigY, margin + sigColWidth, sigY);
    sigY += 5;
    
    // Signer details
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(textColor.r, textColor.g, textColor.b);
    pdf.text(agencySignature.signer_name, margin, sigY);
    sigY += 5;
    
    if (agencySignature.signer_title) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      pdf.text(agencySignature.signer_title, margin, sigY);
      sigY += 5;
    }
    
    sigY += 5;
    pdf.setFontSize(8);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.text(`Date: ${format(new Date(agencySignature.signed_at), 'MMMM d, yyyy')}`, margin, sigY);
  } else {
    // Empty signature lines
    sigY += 17;
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.5);
    pdf.line(margin, sigY, margin + sigColWidth, sigY);
    sigY += 5;
    pdf.setFontSize(8);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.text('Authorized Signature', margin, sigY);
    
    sigY += 15;
    pdf.line(margin, sigY, margin + sigColWidth, sigY);
    sigY += 5;
    pdf.text('Print Name & Title', margin, sigY);
    
    sigY += 15;
    pdf.line(margin, sigY, margin + sigColWidth * 0.6, sigY);
    sigY += 5;
    pdf.text('Date', margin, sigY);
  }
  
  // Client signature block
  const rightX = margin + sigColWidth + 30;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(textColor.r, textColor.g, textColor.b);
  pdf.text('FOR THE CLIENT', rightX, y);
  
  sigY = y + 12;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(client?.business_name || '[Client Name]', rightX, sigY);
  
  sigY += 8;
  
  if (clientSignature?.signature_data) {
    // Add signature image
    try {
      pdf.addImage(clientSignature.signature_data, 'PNG', rightX, sigY, 50, 18);
    } catch (e) {
      // Fallback if image fails
    }
    sigY += 20;
    
    // Signature line
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.5);
    pdf.line(rightX, sigY, rightX + sigColWidth, sigY);
    sigY += 5;
    
    // Signer details
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(textColor.r, textColor.g, textColor.b);
    pdf.text(clientSignature.signer_name, rightX, sigY);
    sigY += 5;
    
    if (clientSignature.signer_title) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
      pdf.text(clientSignature.signer_title, rightX, sigY);
      sigY += 5;
    }
    
    sigY += 5;
    pdf.setFontSize(8);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.text(`Date: ${format(new Date(clientSignature.signed_at), 'MMMM d, yyyy')}`, rightX, sigY);
  } else {
    // Empty signature lines
    sigY += 17;
    pdf.setDrawColor(180, 180, 180);
    pdf.line(rightX, sigY, rightX + sigColWidth, sigY);
    sigY += 5;
    pdf.setFontSize(8);
    pdf.setTextColor(mutedColor.r, mutedColor.g, mutedColor.b);
    pdf.text('Authorized Signature', rightX, sigY);
    
    sigY += 15;
    pdf.line(rightX, sigY, rightX + sigColWidth, sigY);
    sigY += 5;
    pdf.text('Print Name & Title', rightX, sigY);
    
    sigY += 15;
    pdf.line(rightX, sigY, rightX + sigColWidth * 0.6, sigY);
    sigY += 5;
    pdf.text('Date', rightX, sigY);
  }
  
  // Add footer to last page
  addPageFooter();
  
  // Return as blob
  return pdf.output('blob');
}

/**
 * Generate a PDF and return a blob URL for preview
 */
export async function generateContractPdfUrl(
  contract: Contract,
  client?: Client | null,
  options: ContractPdfOptions = {}
): Promise<string> {
  const blob = await generateContractPdfBlob(contract, client, options);
  return URL.createObjectURL(blob);
}

/**
 * Generate a PDF and trigger download
 */
export async function downloadContractPdf(
  contract: Contract,
  client?: Client | null,
  options: ContractPdfOptions = {}
): Promise<void> {
  const blob = await generateContractPdfBlob(contract, client, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${contract.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
