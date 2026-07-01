# @inkora/ai — 🤖 PLACEHOLDER ONLY

The AI tattoo-preview feature is a **UI placeholder** in the MVP.

> ❌ No ML logic · ❌ No inference · ❌ No backend AI · ✅ Interfaces + mock service only

## Why this package exists now
To fix the **service boundary** (`AiPreviewService`) so the Create Idea UI in both apps
codes against the real interface. When a real model ships later, it implements the same
interface and slots in — **zero caller changes**.

## Contents
- `interfaces.ts` — `AiPreviewService` contract
- `mock/` — `MockAiPreviewService`: returns a `draft`/`queued` preview that never completes
  (`resultImagePath` stays null). The UI shows the "coming soon" placeholder.

The DB already models this (`ai_previews` table, `ai_preview_status` enum) — the mock writes
through the same shape so the data contract is exercised end-to-end without any inference.

**TODO:** keep mock-only until AI is in scope. Do not add model/inference code here in the MVP.
