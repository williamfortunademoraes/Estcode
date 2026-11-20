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

const unavailable = (): never => {
  throw new Error('OFFLINE_QUEUE_NOT_AVAILABLE_ON_WEB');
};

export function initializePendingOperations(): void { unavailable(); }
export function enqueuePendingOperation(_operation: Omit<PendingOperation, 'id' | 'status' | 'attempts' | 'last_error'>): void { unavailable(); }
export function listPendingOperations(): PendingOperation[] { return unavailable(); }
export function markPendingOperationFailed(_id: number, _error: string): void { unavailable(); }
export function removePendingOperation(_id: number): void { unavailable(); }
