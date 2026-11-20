# ESTCODE Full System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete ESTCODE stock management application with Supabase/PostgreSQL integrity, role-based access, barcode scanning, deterministic consultancy and critical-path tests.

**Architecture:** Keep Expo Router screens thin. Put validation in Zod schemas, data access in feature services, shared session/profile state in Zustand, and all stock mutations behind PostgreSQL RPCs using row locks and idempotency keys. RLS remains the backend authority.

**Tech Stack:** Expo SDK 58, React Native, TypeScript strict, Expo Router, React Native Paper, Zustand, React Hook Form, Zod, Expo Camera, Expo SQLite, Supabase Auth/PostgreSQL/RLS/RPC/Realtime, Jest and React Native Testing Library.

**Spec:** User-provided ESTCODE master prompt in the conversation.

## Global Constraints

- Single shared inventory in v1, with schema prepared for multiple inventories.
- Portuguese Brazilian interface and no simulated data presented as real.
- `stock_balances.quantity` is never writable from the client; entry, exit and adjustment use RPCs.
- No `service_role` key in the mobile bundle.
- Active user and role checks are enforced in PostgreSQL, not only in the UI.
- Confirmed inventory operations are atomic and idempotent.
- Offline architecture is prepared, but unconfirmed operations are never shown as effective.

## Review Focus

- Concurrent exits cannot produce a negative balance or lost update.
- Retried idempotency keys return the original movement without duplicating history.
- Inactive users and consultants cannot mutate catalog or stock data through direct API calls.
- Missing/invalid public Supabase configuration leaves a visible setup state without crashing import-time rendering.
- Barcode permission denial, repeated scans and unknown codes have explicit user paths.

## Delivery Tasks

- [x] Database migration, seed, RLS, role helpers and transactional RPCs.
- [x] Auth/session/profile routes with protected navigation and password recovery.
- [x] Product/category/supplier services and product management screens.
- [x] Stock operation forms, history filters, shared inventory and pending-operation boundary.
- [x] Expo Camera barcode scanner flow.
- [x] Dashboard metrics, reports and deterministic replenishment consultancy.
- [x] Jest/RNTL tests, SQL/static security checks, documentation and web/Expo validation.

Android build execution remains environment-dependent: the current host has no Android Platform Tools/`adb`. Remote Supabase migrations still require a project owner with deploy credentials.

Each task is verified with the relevant tests plus `npm run typecheck` and `npm run lint` before moving on.
