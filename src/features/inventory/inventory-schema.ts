import { z } from 'zod';

export const movementBaseSchema = z.object({
  inventory_id: z.string().uuid(),
  product_id: z.string().uuid(),
  reason: z.string().trim().min(1, 'Informe o motivo.').max(240),
  notes: z.string().trim().max(2000).nullable().optional(),
  idempotency_key: z.string().uuid().optional(),
});

export const entrySchema = movementBaseSchema.extend({
  quantity: z.number().finite().positive('A quantidade deve ser maior que zero.'),
});

export const exitSchema = entrySchema;

export const adjustmentSchema = movementBaseSchema.extend({
  counted_quantity: z.number().finite().min(0, 'A contagem não pode ser negativa.'),
});

export type EntryInput = z.infer<typeof entrySchema>;
export type ExitInput = z.infer<typeof exitSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
