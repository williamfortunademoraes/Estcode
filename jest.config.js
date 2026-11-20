/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  collectCoverageFrom: [
    'src/features/auth/auth-schema.ts',
    'src/features/auth/permissions.ts',
    'src/features/barcode/barcode-rules.ts',
    'src/features/consultancy/replenishment-rules.ts',
    'src/features/inventory/inventory-schema.ts',
    'src/features/inventory/stock-rules.ts',
    'src/features/products/product-error.ts',
    'src/features/products/product-schema.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
