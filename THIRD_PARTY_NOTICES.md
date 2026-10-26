# Third-party material and release review

Inkora's original code is proprietary. This does not change the licenses of dependencies or third-party material, or grant rights in assets owned by others.

| Material | Location | Required release record |
| --- | --- | --- |
| Tattoo-style example photographs/artwork | `supabase/storage/styles/*.jpg` (ten files) | Creator, original source, redistribution/derivative-use permission, attribution and any required consent. No complete provenance/license record accompanies these files. |
| Inkora branding | `apps/mobile/assets/images/` | Confirm ownership or commissioned/licensed rights and document any external components. |
| Seeded/hosted inspiration imagery | Seed SQL, storage paths and external image URLs | Identify demo versus user content, source terms and whether repository or screenshot distribution is permitted. Hosted accessibility does not establish reuse rights. |
| User portfolios, messages and body photos | Runtime storage, not general source fixtures | Do not export real user content into source, screenshots or sample datasets without the necessary permission. Use controlled demo content for captures. |
| Package dependencies | `pnpm-lock.yaml` and package manifests | Retain the applicable dependency notices/licenses in distributed builds; the proprietary notice does not override them. |

Record the path, creator, source URL, exact terms, attribution, modifications and review outcome for retained external assets. Keep build/setup assets until a deliberate replacement or removal is agreed; do not conceal missing rights by merely ignoring a tracked file.

Review historical copies before making the implementation public. Public code visibility is separate from permission to reuse it. See [the roadmap](docs/ROADMAP.md) for outstanding work.
