/**
 * Generate or revise a contract document.
 *
 * Two flows:
 *   - Revision (revisionFeedback + existingContent present): rewrites
 *     the existing document via Gemini.
 *   - New contract: pulls the default template, swaps placeholders, and
 *     optionally runs Gemini to upgrade Section 2 (Scope of Services) when
 *     a custom scope is supplied.
 *
 * Contract preserved:
 *   Request:  { clientId?, ...form fields, revisionFeedback?, existingContent? }
 *   Response: { content }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound } from '../_shared/errors.ts';
import { ensureOptionalString, ensureOptionalUuid, ensureOptionalEnum, ensureNumber } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess, requireUser } from '../_shared/auth.ts';
import { callGemini } from '../_shared/gemini.ts';

const REVISION_SYSTEM = `You are a professional contract editor. Your job is to revise an existing contract based on feedback while maintaining the professional structure and legal language.

CRITICAL RULES:
1. Output PLAIN TEXT ONLY - absolutely NO markdown formatting
2. Do NOT use ** for bold, do NOT use # for headings
3. Keep the same section numbering and structure
4. Only modify the sections specifically mentioned in the feedback
5. Maintain all legal language and terms not mentioned in the feedback`;

const SCOPE_REWRITE_SYSTEM = `You are a professional contract writer. You need to update ONLY section 2 (SCOPE OF SERVICES) of a contract based on the custom scope provided.

CRITICAL RULES:
1. Output ONLY the updated Section 2 content
2. Keep the same subsection numbering (2.1, 2.2, 2.3)
3. Output PLAIN TEXT ONLY - no markdown
4. Maintain professional legal language
5. Keep the Change Requests clause (2.3) largely intact`;

const BILLING_INTERVALS = ['monthly', 'quarterly', 'yearly', 'one_time'] as const;
type BillingInterval = typeof BILLING_INTERVALS[number];

interface RequestBody {
  clientId?: unknown;
  contractType?: unknown;
  scopeOfWork?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  paymentTerms?: unknown;
  deliverables?: unknown;
  revisionFeedback?: unknown;
  existingContent?: unknown;
  agencyName?: unknown;
  agencyContactName?: unknown;
  agencyEmail?: unknown;
  agencyPhone?: unknown;
  clientContactName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
  paymentAmount?: unknown;
  paymentCurrency?: unknown;
  billingInterval?: unknown;
  initialPaymentAmount?: unknown;
  governingJurisdiction?: unknown;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '');
}

function formatDate(value?: string): string {
  if (!value) return 'To be specified';
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return value;
  }
}

Deno.serve(withErrorHandling({ fn: 'generate-contract' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureOptionalUuid('clientId', body.clientId);
  const scopeOfWork = ensureOptionalString('scopeOfWork', body.scopeOfWork, 50_000);
  const startDate = ensureOptionalString('startDate', body.startDate, 50);
  const endDate = ensureOptionalString('endDate', body.endDate, 50);
  const deliverables = ensureOptionalString('deliverables', body.deliverables, 50_000);
  const revisionFeedback = ensureOptionalString('revisionFeedback', body.revisionFeedback, 20_000);
  const existingContent = ensureOptionalString('existingContent', body.existingContent, 200_000);
  const paymentCurrency = ensureOptionalString('paymentCurrency', body.paymentCurrency, 10) ?? 'USD';
  const billingInterval = ensureOptionalEnum<BillingInterval>('billingInterval', body.billingInterval, BILLING_INTERVALS);
  const governingJurisdiction = ensureOptionalString('governingJurisdiction', body.governingJurisdiction, 200) ?? 'California, USA';
  const paymentAmount = body.paymentAmount === undefined || body.paymentAmount === null ? undefined : ensureNumber('paymentAmount', body.paymentAmount, { min: 0 });
  const initialPaymentAmount = body.initialPaymentAmount === undefined || body.initialPaymentAmount === null ? undefined : ensureNumber('initialPaymentAmount', body.initialPaymentAmount, { min: 0 });

  if (clientId) await requireClientAccess(req, clientId);
  else await requireUser(req);

  const supabase = getSupabaseAdmin();

  let clientInfo: { business_name: string; mrr: number | null } | null = null;
  if (clientId) {
    const { data } = await supabase
      .from('clients')
      .select('business_name, contact_name, email, phone, website, industry, mrr')
      .eq('id', clientId)
      .maybeSingle();
    if (data) clientInfo = data as typeof clientInfo;
  }

  const isRevision = Boolean(revisionFeedback && existingContent);

  if (isRevision) {
    const { text } = await callGemini({
      messages: [
        { role: 'system', content: REVISION_SYSTEM },
        { role: 'user', content: `Please revise this existing contract based on the feedback provided.

EXISTING CONTRACT:
${existingContent}

REVISION FEEDBACK:
${revisionFeedback}

Return only the revised contract content with no markdown formatting.` },
      ],
      maxTokens: 8_000,
    });
    log.info('contract_revised', { length: text.length });
    return jsonResponse({ content: stripMarkdown(text) });
  }

  // New contract — pull default template.
  const { data: template, error: templateError } = await supabase
    .from('contract_templates')
    .select('content')
    .eq('is_default', true)
    .maybeSingle();
  if (templateError) throw new Error(templateError.message);
  if (!template) throw notFound('No default contract template found');

  const clientName = clientInfo?.business_name ?? 'Client';
  const formatPaymentAmount = (): string => {
    const amount = paymentAmount ?? clientInfo?.mrr ?? 0;
    if (billingInterval && billingInterval !== 'one_time') {
      const intervalMap: Record<BillingInterval, string> = { monthly: 'month', quarterly: 'quarter', yearly: 'year', one_time: 'one_time' };
      const intervalLabel = intervalMap[billingInterval];
      if (initialPaymentAmount && initialPaymentAmount !== amount) {
        return `${initialPaymentAmount.toLocaleString()} ${paymentCurrency} for the first ${intervalLabel}, then ${amount.toLocaleString()} ${paymentCurrency} per ${intervalLabel}`;
      }
      return `${amount.toLocaleString()} ${paymentCurrency} per ${intervalLabel}`;
    }
    return `${amount.toLocaleString()} ${paymentCurrency}`;
  };

  let content = template.content as string;
  const replacements: Record<string, string> = {
    '[EFFECTIVE DATE]': formatDate(startDate ?? undefined),
    '[CLIENT]': clientName,
    '[END DATE]': formatDate(endDate ?? undefined),
    '[MONTHLY FEE]': formatPaymentAmount(),
    '[GOVERNING JURISDICTION]': governingJurisdiction,
  };
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.split(placeholder).join(value);
  }

  if (scopeOfWork?.trim()) {
    try {
      const { text } = await callGemini({
        messages: [
          { role: 'system', content: SCOPE_REWRITE_SYSTEM },
          { role: 'user', content: `Update Section 2 (SCOPE OF SERVICES) based on this custom scope:

${scopeOfWork}

${deliverables ? `Deliverables to include: ${deliverables}` : ''}

Return ONLY the Section 2 content, starting with "2. SCOPE OF SERVICES"` },
        ],
        maxTokens: 4_000,
      });
      const newSection2 = stripMarkdown(text).trim();
      const s2 = content.indexOf('2. SCOPE OF SERVICES');
      const s3 = content.indexOf('3. DELIVERABLES');
      if (s2 !== -1 && s3 !== -1) {
        content = `${content.substring(0, s2)}${newSection2}\n\n${content.substring(s3)}`;
      }
    } catch (err) {
      log.warn('scope_rewrite_failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  log.info('contract_generated', { clientName, length: content.length });
  return jsonResponse({ content });
}));
