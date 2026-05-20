/**
 * Record a contract signature (agency or client).
 *
 * Contract preserved:
 *   Request:  { contract_id, signer_role, signer_name, signer_email,
 *               signer_title?, intent_confirmed, consent_to_electronic,
 *               signature_data, signature_type }
 *   Response: { success, signature_id, is_fully_signed, message }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, conflict } from '../_shared/errors.ts';
import { ensureBoolean, ensureEnum, ensureNonEmptyString, ensureOptionalString, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const ROLES = ['agency', 'client'] as const;
type Role = typeof ROLES[number];

interface RequestBody {
  contract_id: unknown;
  signer_role: unknown;
  signer_name: unknown;
  signer_email: unknown;
  signer_title?: unknown;
  intent_confirmed: unknown;
  consent_to_electronic: unknown;
  signature_data: unknown;
  signature_type?: unknown;
}

Deno.serve(withErrorHandling({ fn: 'sign-contract' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const contract_id = ensureUuid('contract_id', body.contract_id);
  const signer_role = ensureEnum<Role>('signer_role', body.signer_role, ROLES);
  const signer_name = ensureNonEmptyString('signer_name', body.signer_name, 200);
  const signer_email = ensureNonEmptyString('signer_email', body.signer_email, 320);
  const signer_title = ensureOptionalString('signer_title', body.signer_title, 200);
  const intent_confirmed = ensureBoolean('intent_confirmed', body.intent_confirmed);
  const consent_to_electronic = ensureBoolean('consent_to_electronic', body.consent_to_electronic);
  const signature_data = ensureNonEmptyString('signature_data', body.signature_data, 5_000_000);
  const signature_type = ensureOptionalString('signature_type', body.signature_type, 50) ?? 'drawn';

  if (!intent_confirmed || !consent_to_electronic) {
    throw badRequest('Intent and consent confirmations are required for legal compliance');
  }

  const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'Unknown';
  const userAgent = req.headers.get('user-agent') ?? 'Unknown';

  const supabase = getSupabaseAdmin();

  const { data: existing, error: checkError } = await supabase
    .from('contract_signatures')
    .select('id')
    .eq('contract_id', contract_id)
    .eq('signer_role', signer_role)
    .not('signed_at', 'is', null)
    .maybeSingle();
  if (checkError) throw new Error(checkError.message);
  if (existing) throw conflict(`This contract has already been signed by the ${signer_role}`);

  const { data: signature, error: insertError } = await supabase
    .from('contract_signatures')
    .insert({
      contract_id,
      signer_role,
      signer_name,
      signer_email,
      signer_title: signer_title ?? null,
      intent_confirmed,
      consent_to_electronic,
      signature_data,
      signature_type,
      signed_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);

  log.info('signature_recorded', { contract_id, signer_role, signature_id: signature.id });

  const { data: allSigs, error: sigsError } = await supabase
    .from('contract_signatures')
    .select('*')
    .eq('contract_id', contract_id)
    .not('signed_at', 'is', null);
  if (sigsError) throw new Error(sigsError.message);

  const agencySigned = allSigs.some((s) => s.signer_role === 'agency');
  const clientSigned = allSigs.some((s) => s.signer_role === 'client');
  const isFullySigned = agencySigned && clientSigned;

  if (isFullySigned) {
    const { error: updateContractError } = await supabase
      .from('contracts')
      .update({ status: 'signed', updated_at: new Date().toISOString() })
      .eq('id', contract_id);
    if (updateContractError) log.warn('contract_status_update_failed', { error: updateContractError.message });

    const { error: linkError } = await supabase
      .from('contract_share_links')
      .update({ expires_at: null })
      .eq('contract_id', contract_id)
      .eq('is_active', true);
    if (linkError) log.warn('share_link_expiry_clear_failed', { error: linkError.message });
  }

  return jsonResponse({
    success: true,
    signature_id: signature.id,
    is_fully_signed: isFullySigned,
    message: isFullySigned
      ? 'Contract is now fully signed by both parties!'
      : `${signer_role === 'agency' ? 'Agency' : 'Client'} signature recorded. Waiting for ${signer_role === 'agency' ? 'client' : 'agency'} signature.`,
  });
}));
