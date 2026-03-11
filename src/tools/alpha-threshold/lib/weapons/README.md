# Weapons Data Layer

This folder holds the source-agnostic weapon pipeline for the Alpha vs Threshold tool.

## Purpose

UI components should only consume normalized `WeaponRecord` data.
Source-specific parsing belongs in adapters.

## Structure

- `types.ts`
  Shared weapon data-layer types, including `ManualWeaponSeed`.
- `normalize.ts`
  Shared normalization helpers such as:
  - `parseWeaponSize`
  - `normalizeWeaponClass`
  - `inferWeaponClass`
  - `createWeaponId`
- `grouping.ts`
  Search/filter/grouping utilities that operate on `WeaponRecord[]` only.
- `merge.ts`
  Future multi-source reconciliation for merging normalized records.
- `adapters/manual.ts`
  Current manual seed -> `WeaponRecord` adapter used by local tool data.
- `adapters/erkul.ts`
  Stub adapter for future Erkul ingestion.
- `adapters/spviewer.ts`
  Stub adapter for future SPViewer ingestion.
- `adapters/scunpacked.ts`
  Stub adapter for future scunpacked ingestion.

## Data Flow

1. Source payload enters through an adapter.
2. Adapter returns normalized `WeaponRecord`.
3. Optional merge/reconciliation happens in `merge.ts`.
4. UI-facing filtering/grouping happens in `grouping.ts`.

## Rule

Do not bind UI components directly to source payload field names.
Always normalize first.
