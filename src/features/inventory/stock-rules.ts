export interface ExitValidation {
  allowed: boolean;
  resultingBalance: number;
  reason?: 'insufficient_stock';
}

export function calculateAdjustment(previousBalance: number, countedQuantity: number) {
  return {
    delta: countedQuantity - previousBalance,
    resultingBalance: countedQuantity,
  };
}

export function validateExit(quantity: number, currentBalance: number, allowNegativeBalance: boolean): ExitValidation {
  const resultingBalance = currentBalance - quantity;
  if (resultingBalance < 0 && !allowNegativeBalance) {
    return { allowed: false, resultingBalance, reason: 'insufficient_stock' };
  }
  return { allowed: true, resultingBalance };
}
