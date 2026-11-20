export type UserRole = 'admin' | 'operator' | 'consultant';

export type MovementType = 'entry' | 'exit' | 'adjustment';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  minimum_stock: number;
  target_stock: number;
  cost_price: number | null;
  sale_price: number | null;
  image_path: string | null;
  image_url?: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventorySettings {
  inventory_id: string;
  allow_negative_balance: boolean;
  allow_operator_adjustments: boolean;
  global_minimum_stock: number;
  created_at: string;
  updated_at: string;
}

export interface StockBalance {
  id: string;
  inventory_id: string;
  product_id: string;
  quantity: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  inventory_id: string;
  product_id: string;
  user_id: string;
  movement_type: MovementType;
  quantity: number;
  counted_quantity: number | null;
  previous_balance: number;
  resulting_balance: number;
  reason: string;
  notes: string | null;
  idempotency_key: string;
  created_at: string;
}

export interface StockMovementResult {
  movement_id: string;
  inventory_id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  previous_balance: number;
  resulting_balance: number;
  counted_quantity: number | null;
  reason: string;
  notes: string | null;
  created_at: string;
  was_duplicate: boolean;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DashboardMetrics {
  total_products: number;
  total_quantity: number;
  below_minimum: number;
  entries_30d: number;
  exits_30d: number;
  movements_30d: number;
}

export interface ReplenishmentSuggestion {
  product_id: string;
  product_name: string;
  sku: string | null;
  current_quantity: number;
  minimum_stock: number;
  target_stock: number;
  suggested_quantity: number;
  criteria: string;
}

export interface InventoryInsights {
  no_movement: { id: string; name: string; sku: string | null }[];
  top_exits_30d: { id: string; name: string; sku: string | null; quantity: number }[];
  consumption_history: { date: string; quantity: number }[];
  criteria: {
    no_movement: string;
    top_exits_30d: string;
    consumption_history: string;
  };
}
