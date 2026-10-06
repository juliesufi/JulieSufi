# Julie Sufi source handover - 6 October 2026 public-access update

This replaces the earlier version 10 ZIP. The storefront is now public; /admin and draft previews prompt for the admin password. Server-side checks still protect admin data, uploads, Instagram management and enquiry reading/updating. Public visitors can browse published content, view the public Instagram feed and submit enquiries. Hidden content and private prices are filtered by lib/studio-model.ts.

## Source and setup

Complete tracked application source is included: React 19/TypeScript/Vinext, Vite, Cloudflare Workers API routes, D1 schema/migrations, R2 upload/media routes, admin UI, tests and the pnpm lockfile. Use Node >=22.13.0 and the pnpm version pinned in package.json. Install with the frozen lockfile. Refer to package.json and this document before the generic starter README.md.

This source still uses Sites-specific scaffolding in vite.config.ts and build/sites-vite-plugin.ts. Independent deployment requires configuring the owner's Cloudflare account, build/deploy workflow and actual resource bindings. DB is the D1 binding; BUCKET is the R2 binding. The placeholder local bindings and .openai/hosting.json are not standalone production credentials. Use separate local/staging resources and apply the existing schema to an empty test database. Do not reseed or overwrite production on deploy.

## Required server-side secrets

- ADMIN_PASSCODE: the owner's chosen admin password, configured securely on the host. The production value is deliberately not included in source or this ZIP.
- ADMIN_SESSION_SECRET: a separate cryptographically random signing secret. Generate a new value for a new host. Both this secret and the password participate in session signing; changing either invalidates existing sessions.
- INSTAGRAM_ENCRYPTION_KEY: needed for encrypted Instagram settings, when using that integration. Existing encrypted records require the matching key, otherwise configure and reconnect Instagram afresh.

There is no fallback admin password. Missing authentication configuration fails closed. Login is limited to 10 attempts per IP per 15 minutes. Enquiries are limited to 5 submissions per IP per 10 minutes. Limits persist atomically in D1 site_settings under request-limit: keys. The Cloudflare-provided CF-Connecting-IP header is used; another host must provide a trusted client-address mechanism rather than accept spoofed forwarding headers. Expired limiter records are periodically cleaned up.

The former visitor/admin shared gate is removed. Old admin cookies are invalidated by the new signing scheme and secret configuration. This is a shared-password admin, not an individual-user/MFA account system.

## Data not included in the ZIP

The ZIP contains code and schema, not the live database, uploaded R2 photos/videos, secret values, installed dependencies or Git history. Export the database and objects separately through authorised access. Current edited content is principally in site_settings.studio_v2 (draft and live documents); enquiries use enquiry: keys. The legacy collections/products/pages tables alone are not a complete live-content export.

Copy original media including retained hidden uploads; verify object counts and integrity. Preserve object keys and /api/media/... references, and audit absolute old-host URLs. Do not assume starter data is a backup. Preserve encrypted integration records only with compatible keys. Do not migrate ephemeral upload/OAuth/rate-limit records as business content.

## Validation and remaining migration work

Run pnpm exec tsc --noEmit. Isolated checks use:

    node --experimental-vm-modules scripts/test-public-access.mjs
    node --experimental-vm-modules scripts/test-october-updates.mjs
    node --experimental-vm-modules scripts/test-refinements.mjs

The local integration script scripts/test-studio.mjs writes only to its configured local preview; inspect it before use and provide TEST_ADMIN_PASSCODE plus the local Worker's authentication secrets. Never point it at production.

Instagram origin/callback remains tied to the current chatgpt.site hostname; update it and Meta settings for a custom domain. Verify actual feed connection independently. Enquiry email notifications are not connected. Preserve email DNS, verify HTTPS, redirects, search indexing and backups during migration. Test real devices and restore backups before final cutover. Automated access checks are not a comprehensive security audit.

For future ChatGPT/Codex edits, keep this code in the business-owned private repository, provide authorised development access and use reviewed branches/staging/releases. Admin Save & publish changes database content; code deployment must preserve that content. This ZIP export does not itself migrate hosting or data.
