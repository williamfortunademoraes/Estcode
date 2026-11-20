// TypeScript's resolver uses this neutral declaration while Metro selects the
// platform-specific implementation (`.native.ts` or `.web.ts`) at runtime.
export * from './pending-operations.native';
