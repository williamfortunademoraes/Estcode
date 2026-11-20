import * as SQLite from 'expo-sqlite';

export type PendingOperationType = 'entry' | 'exit' | 'adjustment';
export type PendingOperationStatus = 'pending' | 'failed';

export interface PendingOperation {
  id: number;
  operation_type: PendingOperationType;
  idempotency_key: string;
  payload: string;
  status: PendingOperationStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

let database: SQLite.SQLiteDatabase | null = null;

function getDatabase(): SQLite.SQLiteDatabase {
  database ??= SQLite.openDatabaseSync('estcode.db');
  return database;
}

export function initializePendingOperations(): void {
  getDatabase().execSync(`
    CREATE TABLE IF NOT EXISTS pending_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL CHECK (operation_type IN ('entry', 'exit', 'adjustment')),
      idempotency_key TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export function enqueuePendingOperation(operation: Omit<PendingOperation, 'id' | 'status' | 'attempts' | 'last_error'>): void {
  const db = getDatabase();
  initializePendingOperations();
  db.runSync(
    `INSERT INTO pending_operations (operation_type, idempotency_key, payload, created_at) VALUES (?, ?, ?, ?)`,
    operation.operation_type,
    operation.idempotency_key,
    operation.payload,
    operation.created_at,
  );
}

export function listPendingOperations(): PendingOperation[] {
  const db = getDatabase();
  initializePendingOperations();
  return db.getAllSync<PendingOperation>(
    `SELECT id, operation_type, idempotency_key, payload, status, attempts, last_error, created_at FROM pending_operations ORDER BY id ASC`,
  );
}

export function markPendingOperationFailed(id: number, error: string): void {
  const db = getDatabase();
  db.runSync(`UPDATE pending_operations SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?`, error, id);
}

export function removePendingOperation(id: number): void {
  const db = getDatabase();
  db.runSync(`DELETE FROM pending_operations WHERE id = ?`, id);
}
