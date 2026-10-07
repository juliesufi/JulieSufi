# Julie Sufi — agent notes

Concise guidance for AI agents. Prefer this file and `DEVELOPER_HANDOVER.md` over the generic starter `README.md`.

## What this is

Melbourne bridal couture **storefront** + password-protected **admin studio** CMS.

- Public: published content, Instagram feed, enquiry form
- Admin (`/admin`, draft previews): shared passcode; server checks protect data, uploads, Instagram, enquiry inbox

## Stack

- Next 16 App Router via **vinext** + Vite; React 19; Tailwind 4; shadcn (`components/ui`)
- Cloudflare Workers; **D1** (prod) or local **MySQL** when `MYSQL_DATABASE` is set
- Media: **R2** (`BUCKET`) hosted; `public/` in MySQL local mode
- Package manager: **pnpm** (pinned in `package.json`); Node `>=22.13.0`

## Commands

```bash
pnpm run install:ci   # frozen lockfile
pnpm run dev          # local HMR (~5173)
pnpm run build
pnpm run lint
pnpm exec tsc --noEmit
```

Local MySQL schema: `scripts/mysql-schema.sql`. Env template: `.dev.vars.example` (never commit `.dev.vars`).

## Source of truth

| Concern | Location |
|--------|----------|
| Live CMS content | `site_settings` key `studio_v2` (`draft` / `live` / `revision`) — `lib/studio-store.ts` |
| Zod model + public filter | `lib/studio-model.ts` |
| Admin auth cookie | `lib/admin-auth.ts` (`ADMIN_PASSCODE` + `ADMIN_SESSION_SECRET`, fail closed) |
| DB access | `getD1()` in `lib/site-data.ts` (MySQL adapter if configured, else `env.DB`) |
| Storefront shell | `components/boutique.tsx` (most `app/**` pages re-export it) |
| Admin CMS UI | `components/studio.tsx` |
| Bindings | `.openai/hosting.json` (`DB`, `BUCKET`) |

Legacy `pages` / `collections` / `products` tables are not the live edit target.

## Conventions

1. **Do not wipe** `studio_v2`, enquiries, or R2 on code deploy — Save & publish is DB content.
2. Admin POST `/api/admin/data` uses **optimistic concurrency** (`revision`); mismatch → 409.
3. Admin mutations: `isAdminRequest`; also check same-origin on admin data POST.
4. Prefer portable SQL already used in `lib/studio-store.ts` / `lib/request-limit.ts` (D1-style via MySQL HTTP proxy in local MySQL mode).
5. Path alias `@/*` → repo root. Brand CSS: `app/globals.css` (+ layered studio/refinement CSS).
6. Do not implement reserved SIWC paths (`/signin-with-chatgpt`, etc.).
7. Ignore build junk: `.sites-runtime/`, `.wrangler/`, `.uploads-temp/`.

## Where to edit

| Task | Start here |
|------|------------|
| Storefront UI | `components/boutique.tsx`, related feature components |
| Studio CMS | `components/studio.tsx`, `lib/studio-model.ts` |
| Public APIs | `app/api/storefront`, `enquiries`, `instagram`, `media` |
| Admin APIs | `app/api/admin/**` |
| Uploads | `lib/media-storage.ts`, `app/api/admin/uploads` |
| Schema | `db/schema.ts`, `drizzle/` |

## Tests (local only)

```bash
node --experimental-vm-modules scripts/test-public-access.mjs
node --experimental-vm-modules scripts/test-october-updates.mjs
node --experimental-vm-modules scripts/test-refinements.mjs
```

`scripts/test-studio.mjs` needs local secrets / `TEST_ADMIN_PASSCODE` — never point at production.

## Do not

- Commit secrets (`.dev.vars`, passcodes, encryption keys)
- Reseed or overwrite production DB/media from starter data
- Add a fallback admin password
- Treat `README.md` as product docs for this boutique
