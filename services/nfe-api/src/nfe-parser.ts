import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { gunzipSync } from 'node:zlib';

export type NfeDocument = {
  nsu: string;
  schema: string;
  xml: string;
};

export type ParsedDistribution = {
  cStat: number;
  reason: string;
  lastNsu: string;
  maxNsu: string;
  documents: NfeDocument[];
};

const MAX_XML_BYTES = 8 * 1024 * 1024;
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
});

function rejectUnsafeXml(xml: string): void {
  if (Buffer.byteLength(xml, 'utf8') > MAX_XML_BYTES) throw new Error('NFE_XML_TOO_LARGE');
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('NFE_XML_DTD_NOT_ALLOWED');
  if (XMLValidator.validate(xml) !== true) throw new Error('NFE_XML_INVALID');
}

function text(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function findKey(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (key in record) return record[key];
  for (const child of Object.values(record)) {
    const found = findKey(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function parseDistributionResponse(xml: string): ParsedDistribution {
  rejectUnsafeXml(xml);
  const parsed = parser.parse(xml) as unknown;
  const ret = findKey(parsed, 'retDistDFeInt') as Record<string, unknown> | undefined;
  if (!ret) throw new Error('NFE_DISTRIBUTION_RESULT_MISSING');
  const cStat = Number(text(ret.cStat));
  const lastNsu = text(ret.ultNSU);
  const maxNsu = text(ret.maxNSU);
  if (!Number.isInteger(cStat) || !/^\d{1,15}$/.test(lastNsu) || !/^\d{1,15}$/.test(maxNsu)) {
    throw new Error('NFE_DISTRIBUTION_RESULT_INVALID');
  }
  const batch = ret.loteDistDFeInt as Record<string, unknown> | undefined;
  const rawDocs = batch?.docZip;
  const documents: NfeDocument[] = [];
  for (const raw of (Array.isArray(rawDocs) ? rawDocs : rawDocs ? [rawDocs] : [])) {
    const doc = raw as Record<string, unknown>;
    const nsu = text(doc['@_NSU']);
    const schema = text(doc['@_schema']);
    const compressed = text(doc['#text']);
    if (!/^\d{1,15}$/.test(nsu) || !schema || !compressed) throw new Error('NFE_DOCUMENT_ENVELOPE_INVALID');
    let decoded: Buffer;
    try { decoded = gunzipSync(Buffer.from(compressed, 'base64'), { maxOutputLength: MAX_XML_BYTES }); }
    catch { throw new Error('NFE_DOCUMENT_DECOMPRESSION_FAILED'); }
    const documentXml = decoded.toString('utf8');
    rejectUnsafeXml(documentXml);
    documents.push({ nsu, schema, xml: documentXml });
  }
  return { cStat, reason: text(ret.xMotivo), lastNsu, maxNsu, documents };
}

export type ParsedInvoice = {
  documentType: 'summary' | 'full' | 'event' | 'unknown';
  accessKey: string | null;
  issuerName: string | null;
  issuerCnpj: string | null;
  issuedAt: string | null;
  totalAmount: number | null;
  items: Array<{ lineNumber: number; supplierCode: string | null; barcode: string | null; description: string; unit: string | null; quantity: number; unitPrice: number }>;
};

export function parseNfeDocument(xml: string, schema: string): ParsedInvoice {
  rejectUnsafeXml(xml);
  const value = parser.parse(xml) as unknown;
  const full = /procNFe/i.test(schema);
  const summary = /resNFe/i.test(schema);
  const event = /procEvento|resEvento/i.test(schema);
  const inf = findKey(value, 'infNFe') as Record<string, unknown> | undefined;
  const summaryNode = findKey(value, 'resNFe') as Record<string, unknown> | undefined;
  const invoice = inf ?? summaryNode;
  const emit = invoice?.emit as Record<string, unknown> | undefined;
  const ide = invoice?.ide as Record<string, unknown> | undefined;
  const total = invoice?.total as Record<string, unknown> | undefined;
  const icmsTotal = total?.ICMSTot as Record<string, unknown> | undefined;
  const det = inf?.det;
  const items = (Array.isArray(det) ? det : det ? [det] : []).map((item, index) => {
    const row = item as Record<string, unknown>;
    const prod = row.prod as Record<string, unknown> | undefined;
    return {
      lineNumber: Number(text(row['@_nItem'])) || index + 1,
      supplierCode: text(prod?.cProd) || null,
      barcode: text(prod?.cEAN) || null,
      description: text(prod?.xProd),
      unit: text(prod?.uCom) || null,
      quantity: Number(text(prod?.qCom)) || 0,
      unitPrice: Number(text(prod?.vUnCom)) || 0,
    };
  });
  const id = text(inf?.['@_Id']);
  return {
    documentType: full ? 'full' : summary ? 'summary' : event ? 'event' : 'unknown',
    accessKey: (id.match(/\d{44}/)?.[0] ?? text(invoice?.chNFe)) || null,
    issuerName: text(emit?.xNome || invoice?.xNome) || null,
    issuerCnpj: text(emit?.CNPJ || invoice?.CNPJ) || null,
    issuedAt: text(ide?.dhEmi || invoice?.dhEmi) || null,
    totalAmount: Number(text(icmsTotal?.vNF || invoice?.vNF)) || null,
    items,
  };
}
