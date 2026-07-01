# @inkora/domain

The **dependency-free core**. Everything here is pure TypeScript and must run in **web, React Native, and Deno Edge Functions** alike. No React, no Supabase, no `fetch`, no platform APIs.

## Contents

| Folder | Purpose |
|---|---|
| `ids.ts` | Branded ID types (`ProfileId`, `ArtistId`, …) |
| `enums.ts` | Enums mirroring the Postgres enum types (single source = the DB) |
| `pagination.ts` | `Page<T>`, `PageParams` (cursor-based) |
| `errors.ts` | `AppError` taxonomy + Postgres error-code mapping types |
| `auth.ts` | `AuthContext`, role types |
| `models/` | Domain entity types (read models / DTOs) |
| `schemas/` | zod validation schemas (shared client + server). **TODO: define.** |
| `navigation/` | ⭐ SHARED navigation route table — the single source for paths used by BOTH Expo Router and Next App Router |
| `state-machines/` | Declarative transition tables (booking). Guard logic lives in services, not here. |

## Rule
If a value or rule is meaningful to more than one app or to the backend, it belongs here.
If it touches the DOM, a `<View>`, or the network, it does **not**.
