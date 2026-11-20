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
      fiscal_company_settings: TableDefinition<{
        singleton: boolean; cnpj: string; last_nsu: string; max_nsu: string;
        last_consulted_at: string | null; next_allowed_at: string | null; updated_at: string;
      }>;
      incoming_fiscal_documents: TableDefinition<{
        id: string; nsu: string; access_key: string | null; schema: string; document_type: string;
        issuer_cnpj: string | null; issuer_name: string | null; issued_at: string | null;
        total_amount: number | null; fiscal_status: string; xml_path: string; metadata: Record<string, unknown>;
        received_at: string; applied_at: string | null; applied_by: string | null;
      }>;
      incoming_fiscal_document_items: TableDefinition<{
        id: string; document_id: string; line_number: number; supplier_code: string | null;
        barcode: string | null; description: string; unit: string | null; quantity: number;
        unit_price: number; product_id: string | null; mapped_by: string | null; mapped_at: string | null;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      acquire_fiscal_sync_lease: { Args: { p_lease_id: string }; Returns: boolean };
      release_fiscal_sync_lease: { Args: { p_lease_id: string }; Returns: undefined };
      apply_incoming_fiscal_document: { Args: { p_document_id: string }; Returns: Record<string, unknown> };
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
