import { z } from 'zod';

import { isValidGtin } from '@/src/features/barcode/barcode-rules';

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable().default(null),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().uuid().nullable().default(null),
);

const barcode = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .regex(/^\d+$/, 'O código de barras deve conter apenas números.')
    .refine((value) => [8, 12, 13, 14].includes(value.length), 'Informe um GTIN/EAN válido.')
    .refine(isValidGtin, 'O dígito verificador do GTIN/EAN é inválido.')
    .nullable()
    .default(null),
);

export const productSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe o nome do produto.').max(200),
    sku: optionalText(80),
    barcode,
    description: optionalText(2000),
    category_id: optionalUuid,
    supplier_id: optionalUuid,
    unit: z.string().trim().min(1).max(20),
    minimum_stock: z.number().finite().min(0),
    target_stock: z.number().finite().min(0),
    cost_price: z.number().finite().min(0).nullable().default(null),
    sale_price: z.number().finite().min(0).nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine((value) => value.target_stock >= value.minimum_stock, {
    message: 'O estoque-alvo deve ser igual ou maior que o estoque mínimo.',
    path: ['target_stock'],
  });

export type ProductInput = z.infer<typeof productSchema>;
