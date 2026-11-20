import { z } from 'zod';

import { environment } from '@/src/lib/env';
import { supabase } from '@/src/lib/supabase';
import type { Product } from '@/src/types/domain';
import { isValidCnpj } from './cnpj';

const cnpjSchema = z.string().transform((value) => value.replace(/\D/g, '')).refine(isValidCnpj, 'Informe um CNPJ válido com 14 dígitos.');

export type FiscalDocument = {
  id: string; nsu: string; access_key: string | null; document_type: string; issuer_name: string | null;
  issuer_cnpj: string | null; issued_at: string | null; total_amount: number | null;
  fiscal_status: string; received_at: string;
};
export type FiscalItem = { id: string; line_number: number; supplier_code: string | null; barcode: string | null; description: string; unit: string | null; quantity: number; unit_price: number; product_id: string | null };

export async function saveFiscalCompanyCnpj(value: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const parsed = cnpjSchema.safeParse(value);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'CNPJ inválido.');
  const { error } = await supabase.from('fiscal_company_settings').upsert({ singleton: true, cnpj: parsed.data }, { onConflict: 'singleton' });
  if (error) throw new Error('Não foi possível salvar o CNPJ da empresa.');
}

export async function getFiscalCompanyCnpj(): Promise<string> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { data, error } = await supabase.from('fiscal_company_settings').select('cnpj').eq('singleton', true).maybeSingle();
  if (error) throw new Error('Não foi possível consultar as configurações fiscais.');
  return data?.cnpj ?? '';
}

export async function listFiscalDocuments(): Promise<FiscalDocument[]> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { data, error } = await supabase.from('incoming_fiscal_documents')
    .select('id,nsu,access_key,document_type,issuer_name,issuer_cnpj,issued_at,total_amount,fiscal_status,received_at')
    .order('received_at', { ascending: false }).limit(100);
  if (error) throw new Error('Não foi possível carregar as notas fiscais.');
  return (data ?? []) as FiscalDocument[];
}

export async function getFiscalDocumentItems(documentId: string): Promise<FiscalItem[]> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { data, error } = await supabase.from('incoming_fiscal_document_items').select('*').eq('document_id', documentId).order('line_number');
  if (error) throw new Error('Não foi possível carregar os itens da nota.');
  return (data ?? []) as FiscalItem[];
}

export async function mapFiscalItem(itemId: string, productId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { error } = await supabase.from('incoming_fiscal_document_items').update({ product_id: productId, mapped_at: new Date().toISOString() }).eq('id', itemId);
  if (error) throw new Error('Não foi possível associar o item ao produto.');
}

export async function findFiscalItemProducts(search: string): Promise<Product[]> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const query = search.trim();
  if (!query) return [];
  const client = supabase;
  const [names, skus, barcode] = await Promise.all([
    client.from('products').select('id,name,sku,barcode,unit,active').eq('active', true).ilike('name', `%${query}%`).limit(20),
    client.from('products').select('id,name,sku,barcode,unit,active').eq('active', true).ilike('sku', `%${query}%`).limit(20),
    client.from('products').select('id,name,sku,barcode,unit,active').eq('active', true).eq('barcode', query).limit(20),
  ]);
  if (names.error || skus.error || barcode.error) throw new Error('Não foi possível pesquisar produtos.');
  return [...new Map([...names.data, ...skus.data, ...barcode.data].map((product) => [product.id, product])).values()] as unknown as Product[];
}

export async function applyFiscalDocument(documentId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  const { error } = await supabase.rpc('apply_incoming_fiscal_document', { p_document_id: documentId });
  if (error) throw new Error(error.message === 'fiscal_product_unit_mismatch' ? 'A unidade de um item não corresponde à unidade cadastrada no produto.' : error.message === 'fiscal_items_require_product_mapping' ? 'Associe todos os itens a produtos antes de aplicar a entrada.' : 'Não foi possível aplicar a nota. Confira o status, as associações e as permissões.');
}

export async function synchronizeFiscalDocuments(): Promise<{ receivedDocuments: number; nextAllowedAt: string | null }> {
  if (!supabase) throw new Error('Supabase não está configurado.');
  if (!environment.nfeApiUrl) throw new Error('O serviço seguro de consulta fiscal ainda não está configurado.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) throw new Error('Faça login novamente para consultar as notas fiscais.');
  const response = await fetch(`${environment.nfeApiUrl.replace(/\/$/, '')}/v1/nfe/sync`, {
    method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: '{}',
  });
  const result = await response.json() as { error?: string; receivedDocuments?: number; nextAllowedAt?: string | null };
  if (!response.ok) {
    const messages: Record<string, string> = {
      NFE_CERTIFICATE_NOT_CONFIGURED: 'O certificado A1 ainda não foi instalado no serviço fiscal.',
      FISCAL_COMPANY_NOT_CONFIGURED: 'Cadastre o CNPJ da empresa antes da consulta.',
      NFE_MINIMUM_INTERVAL_NOT_REACHED: `A SEFAZ limitou a frequência. Próxima consulta: ${result.nextAllowedAt ?? 'mais tarde'}.`,
      ADMIN_REQUIRED: 'Somente administradores podem consultar notas fiscais.',
    };
    throw new Error(messages[result.error ?? ''] ?? `A consulta fiscal falhou (${result.error ?? response.status}).`);
  }
  return { receivedDocuments: result.receivedDocuments ?? 0, nextAllowedAt: result.nextAllowedAt ?? null };
}
