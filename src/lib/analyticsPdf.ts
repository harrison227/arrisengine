import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AnalyticsData } from '@/hooks/useLateAnalytics';
import { format } from 'date-fns';

export interface PdfExportOptions {
  includeOverview: boolean;
  includeFollowerGrowth: boolean;
  includeEngagement: boolean;
  includeTopPosts: boolean;
  includePlatformBreakdown: boolean;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E4405F',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  linkedin: '#0A66C2',
  tiktok: '#000000',
  youtube: '#FF0000',
};

export async function generateAnalyticsPdf(
  data: AnalyticsData,
  options: PdfExportOptions,
  agencyName?: string
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yOffset = margin;

  // Header
  pdf.setFillColor(30, 41, 59); // Dark grey (Slate 800) - matching contracts
  pdf.rect(0, 0, pageWidth, 40, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Social Media Analytics Report', margin, 25);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.client.name, margin, 35);

  yOffset = 55;

  // Date range
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(10);
  const dateText = data.dateRange.from && data.dateRange.to
    ? `Report Period: ${format(new Date(data.dateRange.from), 'MMM d, yyyy')} - ${format(new Date(data.dateRange.to), 'MMM d, yyyy')}`
    : `Generated: ${format(new Date(), 'MMM d, yyyy')}`;
  pdf.text(dateText, margin, yOffset);
  yOffset += 15;

  // Overview Section
  if (options.includeOverview) {
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Overview', margin, yOffset);
    yOffset += 10;

    const metrics = [
      { label: 'Total Followers', value: formatNumber(data.aggregatedMetrics.totalFollowers) },
      { label: 'Total Impressions', value: formatNumber(data.aggregatedMetrics.totalImpressions) },
      { label: 'Total Reach', value: formatNumber(data.aggregatedMetrics.totalReach) },
      { label: 'Engagement Rate', value: `${data.aggregatedMetrics.averageEngagementRate.toFixed(2)}%` },
    ];

    const boxWidth = (pageWidth - margin * 2 - 15) / 4;
    const boxHeight = 25;

    metrics.forEach((metric, index) => {
      const x = margin + (index * (boxWidth + 5));
      
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(x, yOffset, boxWidth, boxHeight, 2, 2, 'F');
      
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(metric.label, x + 5, yOffset + 8);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(metric.value, x + 5, yOffset + 18);
    });

    yOffset += boxHeight + 15;
  }

  // Engagement Metrics
  if (options.includeEngagement) {
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Engagement Metrics', margin, yOffset);
    yOffset += 10;

    const engagementMetrics = [
      { label: 'Likes', value: formatNumber(data.aggregatedMetrics.totalLikes), icon: '❤️' },
      { label: 'Comments', value: formatNumber(data.aggregatedMetrics.totalComments), icon: '💬' },
      { label: 'Shares', value: formatNumber(data.aggregatedMetrics.totalShares), icon: '🔄' },
      { label: 'Clicks', value: formatNumber(data.aggregatedMetrics.totalClicks), icon: '👆' },
    ];

    const boxWidth = (pageWidth - margin * 2 - 15) / 4;
    const boxHeight = 22;

    engagementMetrics.forEach((metric, index) => {
      const x = margin + (index * (boxWidth + 5));
      
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(x, yOffset, boxWidth, boxHeight, 2, 2, 'F');
      
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(metric.label, x + 5, yOffset + 8);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(metric.value, x + 5, yOffset + 17);
    });

    yOffset += boxHeight + 15;
  }

  // Platform Breakdown
  if (options.includePlatformBreakdown && data.platformBreakdown.length > 0) {
    if (yOffset > pageHeight - 80) {
      pdf.addPage();
      yOffset = margin;
    }

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Platform Breakdown', margin, yOffset);
    yOffset += 10;

    // Table header
    const colWidths = [40, 35, 35, 35, 30];
    const headers = ['Platform', 'Followers', 'Impressions', 'Engagement', 'Posts'];
    
    pdf.setFillColor(30, 41, 59); // Dark grey (Slate 800)
    pdf.rect(margin, yOffset, pageWidth - margin * 2, 8, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    let xOffset = margin + 3;
    headers.forEach((header, i) => {
      pdf.text(header, xOffset, yOffset + 5.5);
      xOffset += colWidths[i];
    });
    
    yOffset += 10;

    // Table rows
    data.platformBreakdown.forEach((platform, index) => {
      if (index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, yOffset - 2, pageWidth - margin * 2, 8, 'F');
      }

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      let xOffset = margin + 3;
      const values = [
        capitalizeFirst(platform.platform),
        formatNumber(platform.followers),
        formatNumber(platform.impressions),
        formatNumber(platform.engagement),
        platform.posts.toString(),
      ];

      values.forEach((value, i) => {
        pdf.text(value, xOffset, yOffset + 4);
        xOffset += colWidths[i];
      });

      yOffset += 8;
    });

    yOffset += 10;
  }

  // Top Posts
  if (options.includeTopPosts && data.topPosts.length > 0) {
    if (yOffset > pageHeight - 60) {
      pdf.addPage();
      yOffset = margin;
    }

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Top Performing Posts', margin, yOffset);
    yOffset += 10;

    const topPostsToShow = data.topPosts.slice(0, 5);

    topPostsToShow.forEach((post, index) => {
      if (yOffset > pageHeight - 30) {
        pdf.addPage();
        yOffset = margin;
      }

      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, yOffset, pageWidth - margin * 2, 20, 2, 2, 'F');

      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${index + 1}. @${post.username} (${capitalizeFirst(post.platform)})`, margin + 5, yOffset + 6);

      const caption = post.caption ? (post.caption.length > 60 ? post.caption.slice(0, 60) + '...' : post.caption) : 'No caption';
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(9);
      pdf.text(caption, margin + 5, yOffset + 12);

      const engagement = `👁️ ${formatNumber(post.impressions || 0)}  ❤️ ${formatNumber(post.likes || 0)}  💬 ${formatNumber(post.comments || 0)}`;
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(8);
      pdf.text(engagement, margin + 5, yOffset + 17);

      yOffset += 24;
    });
  }

  // Footer
  const footerY = pageHeight - 10;
  pdf.setTextColor(150, 150, 150);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  const footerText = agencyName ? `Generated by ${agencyName}` : 'Generated with Agency Command';
  pdf.text(footerText, margin, footerY);
  pdf.text(format(new Date(), 'MMM d, yyyy HH:mm'), pageWidth - margin - 30, footerY);

  // Save
  const fileName = `${data.client.name.replace(/\s+/g, '-')}-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  pdf.save(fileName);
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
