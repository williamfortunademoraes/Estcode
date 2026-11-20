import type {
  Category,
  DashboardMetrics,
  AuditLog,
  Inventory,
  InventoryInsights,
  InventorySettings,
  Product,
  Profile,
  ReplenishmentSuggestion,
  StockBalance,
  StockMovement,
  StockMovementResult,
  Supplier,
} from './domain';

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDefinition<Row> = {
  Row: Row & Record<string, unknown>;
  Insert: Partial<Omit<Row, 'id' | 'created_at' | 'updated_at'>> & Record<string, unknown>;
  Update: Partial<Omit<Row, 'id' | 'created_at' | 'updated_at'>> & Record<string, unknown>;
  Relationships: Relationship[];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<Profile>;
      inventories: TableDefinition<Inventory>;
      categories: TableDefinition<Category>;
      suppliers: TableDefinition<Supplier>;
      products: TableDefinition<Product>;
      inventory_settings: TableDefinition<InventorySettings>;
      stock_balances: TableDefinition<StockBalance>;
      stock_movements: TableDefinition<StockMovement>;
      audit_logs: TableDefinition<AuditLog>;
    };
    Views: Record<string, never>;
    Functions: {
      register_stock_entry: {
        Args: {
          p_inventory_id: string;
          p_product_id: string;
          p_quantity: number;
          p_reason: string;
          p_notes?: string | null;
          p_idempotency_key?: string;
        };
        Returns: StockMovementResult;
      };
      register_stock_exit: {
        Args: {
          p_inventory_id: string;
          p_product_id: string;
          p_quantity: number;
          p_reason: string;
          p_notes?: string | null;
          p_idempotency_key?: string;
        };
        Returns: StockMovementResult;
      };
      register_stock_adjustment: {
        Args: {
          p_inventory_id: string;
          p_product_id: string;
          p_counted_quantity: number;
          p_reason: string;
          p_notes?: string | null;
          p_idempotency_key?: string;
        };
        Returns: StockMovementResult;
      };
      get_inventory_dashboard: {
        Args: { p_inventory_id: string };
        Returns: DashboardMetrics;
      };
      get_replenishment_suggestions: {
        Args: { p_inventory_id: string };
        Returns: ReplenishmentSuggestion[];
      };
      get_inventory_insights: {
        Args: { p_inventory_id: string };
        Returns: InventoryInsights;
      };
      get_shared_inventory_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
    };
    Enums: {
      user_role: Profile['role'];
      movement_type: StockMovement['movement_type'];
    };
    CompositeTypes: Record<string, never>;
  };
};
