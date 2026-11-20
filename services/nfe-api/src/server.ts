import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

import { parseDistributionResponse, parseNfeDocument } from './nfe-parser';

const PORT = Number(process.env.PORT ?? 8787);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CERTIFICATE = process.env.NFE_CERTIFICATE_PFX_BASE64;
const CERTIFICATE_PASSWORD = process.env.NFE_CERTIFICATE_PASSWORD;
const ENVIRONMENT_CODE = process.env.NFE_ENVIRONMENT_CODE ?? '1';
const ENDPOINT = process.env.NFE_DISTRIBUTION_ENDPOINT ?? 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').map((value: string) => value.trim()).filter(Boolean));
const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';

function respond(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 16_384) reject(new Error('REQUEST_TOO_LARGE'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function soapRequest(cnpj: string, lastNsu: string): Promise<string> {
  if (!CERTIFICATE || !CERTIFICATE_PASSWORD) throw new Error('NFE_CERTIFICATE_NOT_CONFIGURED');
  const endpoint = new URL(ENDPOINT);
  const digits = cnpj.replace(/\D/g, '');
  const nsu = lastNsu.padStart(15, '0');
  if (ENVIRONMENT_CODE !== '1' && ENVIRONMENT_CODE !== '2') throw new Error('NFE_ENVIRONMENT_CODE_INVALID');
  const payload = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg><distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${ENVIRONMENT_CODE}</tpAmb><CNPJ>${digits}</CNPJ><distNSU><ultNSU>${nsu}</ultNSU></distNSU></distDFeInt></nfeDadosMsg></nfeDistDFeInteresse></soap:Body></soap:Envelope>`;
  const pfx = Buffer.from(CERTIFICATE, 'base64');
  return new Promise((resolve, reject) => {
    const req = httpsRequest({
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      method: 'POST',
      pfx,
      passphrase: CERTIFICATE_PASSWORD,
      headers: { 'content-type': 'text/xml; charset=utf-8', SOAPAction: SOAP_ACTION, 'content-length': Buffer.byteLength(payload) },
      timeout: 30_000,
    }, (res) => {
      let response = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        response += chunk;
        if (Buffer.byteLength(response, 'utf8') > 12 * 1024 * 1024) req.destroy(new Error('NFE_RESPONSE_TOO_LARGE'));
      });
      res.on('end', () => res.statusCode && res.statusCode >= 200 && res.statusCode < 300
        ? resolve(response)
        : reject(new Error('NFE_UPSTREAM_HTTP_ERROR')));
    });
    req.on('timeout', () => req.destroy(new Error('NFE_UPSTREAM_TIMEOUT')));
    req.on('error', reject);
    req.end(payload);
  });
}

function sanitizeError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'NFE_SYNC_FAILED';
}

async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const origin = req.headers.origin;
  if (origin && (!ALLOWED_ORIGINS.size || !ALLOWED_ORIGINS.has(origin))) return respond(res, 403, { error: 'ORIGIN_NOT_ALLOWED' });
  if (origin) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader('access-control-allow-headers', 'authorization,content-type');
    res.setHeader('access-control-allow-methods', 'POST,OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/health') return respond(res, 200, { status: 'ok', fiscalCertificateConfigured: Boolean(CERTIFICATE && CERTIFICATE_PASSWORD) });
  if (req.method !== 'POST' || req.url !== '/v1/nfe/sync') return respond(res, 404, { error: 'NOT_FOUND' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return respond(res, 503, { error: 'SUPABASE_API_NOT_CONFIGURED' });
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');
  if (!match) return respond(res, 401, { error: 'AUTH_REQUIRED' });

  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
  const { data: auth, error: authError } = await db.auth.getUser(match[1]);
  if (authError || !auth.user) return respond(res, 401, { error: 'AUTH_INVALID' });
  const { data: profile, error: profileError } = await db.from('profiles').select('role,active').eq('id', auth.user.id).maybeSingle();
  if (profileError || !profile?.active) return respond(res, 403, { error: 'PROFILE_INACTIVE' });
  if (profile.role !== 'admin') return respond(res, 403, { error: 'ADMIN_REQUIRED' });

  let activeLease: string | null = null;
  try {
    await readBody(req);
    const { data: company, error } = await db.from('fiscal_company_settings').select('cnpj,last_nsu,max_nsu,next_allowed_at').eq('singleton', true).maybeSingle();
    if (error) throw new Error('FISCAL_SETTINGS_UNAVAILABLE');
    if (!company) return respond(res, 409, { error: 'FISCAL_COMPANY_NOT_CONFIGURED' });
    if (company.next_allowed_at && Date.parse(company.next_allowed_at) > Date.now()) return respond(res, 429, { error: 'NFE_MINIMUM_INTERVAL_NOT_REACHED', nextAllowedAt: company.next_allowed_at });
    activeLease = randomUUID();
    const { data: acquired, error: leaseError } = await db.rpc('acquire_fiscal_sync_lease', { p_lease_id: activeLease });
    if (leaseError) throw new Error('NFE_SYNC_LOCK_FAILED');
    if (!acquired) return respond(res, 409, { error: 'NFE_SYNC_ALREADY_RUNNING' });
    const xml = await soapRequest(company.cnpj, company.last_nsu);
    const result = parseDistributionResponse(xml);
    if (result.cStat !== 137 && result.cStat !== 138) {
      if (result.cStat === 656) await db.from('fiscal_company_settings').update({ last_consulted_at: new Date().toISOString(), next_allowed_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).eq('singleton', true);
      return respond(res, 502, { error: 'NFE_SEFAZ_STATUS', cStat: result.cStat, reason: result.reason });
    }
    const nextAllowedAt = result.cStat === 137 || result.lastNsu === result.maxNsu
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : null;
    for (const doc of result.documents) {
      const parsed = parseNfeDocument(doc.xml, doc.schema);
      const nsu = doc.nsu.padStart(15, '0');
      const { data: existing } = await db.from('incoming_fiscal_documents').select('id').eq('nsu', nsu).maybeSingle();
      const documentId = existing?.id ?? randomUUID();
      const { error: insertError } = await db.from('incoming_fiscal_documents').upsert({
        id: documentId, nsu, access_key: parsed.accessKey, schema: doc.schema,
        document_type: parsed.documentType, issuer_cnpj: parsed.issuerCnpj,
        issuer_name: parsed.issuerName, issued_at: parsed.issuedAt,
        total_amount: parsed.totalAmount, fiscal_status: parsed.documentType === 'full' ? 'ready_for_review' : 'awaiting_manifestation',
        xml_path: `${documentId}.xml`,
        metadata: { documentType: parsed.documentType },
      }, { onConflict: 'nsu', ignoreDuplicates: true });
      if (insertError) throw new Error('NFE_DOCUMENT_SAVE_FAILED');
      const { data: saved } = await db.from('incoming_fiscal_documents').select('id').eq('nsu', nsu).single();
      if (!saved) throw new Error('NFE_DOCUMENT_SAVE_FAILED');
      const { error: uploadError } = await db.storage.from('incoming-fiscal-xml').upload(`${saved.id}.xml`, doc.xml, { contentType: 'application/xml', upsert: true });
      if (uploadError) throw new Error('NFE_XML_SAVE_FAILED');
      if (parsed.items.length) {
        const { error: itemsError } = await db.from('incoming_fiscal_document_items').upsert(parsed.items.map((item) => ({
          document_id: saved.id, line_number: item.lineNumber, supplier_code: item.supplierCode,
          barcode: item.barcode, description: item.description, unit: item.unit,
          quantity: item.quantity, unit_price: item.unitPrice,
        })), { onConflict: 'document_id,line_number' });
        if (itemsError) throw new Error('NFE_ITEMS_SAVE_FAILED');
      }
    }
    const checkpoint = result.lastNsu.padStart(15, '0');
    const { error: updateError } = await db.from('fiscal_company_settings').update({ last_nsu: checkpoint, max_nsu: result.maxNsu.padStart(15, '0'), last_consulted_at: new Date().toISOString(), next_allowed_at: nextAllowedAt }).eq('singleton', true);
    if (updateError) throw new Error('NFE_CHECKPOINT_SAVE_FAILED');
    await db.rpc('release_fiscal_sync_lease', { p_lease_id: activeLease });
    activeLease = null;
    return respond(res, 200, { cStat: result.cStat, reason: result.reason, lastNsu: checkpoint, maxNsu: result.maxNsu.padStart(15, '0'), receivedDocuments: result.documents.length, nextAllowedAt });
  } catch (error) {
    if (activeLease) await db.rpc('release_fiscal_sync_lease', { p_lease_id: activeLease });
    return respond(res, 502, { error: sanitizeError(error) });
  }
}

createServer((req, res) => { void handler(req, res).catch(() => respond(res, 500, { error: 'INTERNAL_ERROR' })); })
  .listen(PORT, '0.0.0.0', () => process.stdout.write(`nfe-api listening on ${PORT}\n`));
