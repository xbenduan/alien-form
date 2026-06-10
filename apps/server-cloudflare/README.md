# server-cloudflare

Cloudflare Worker backend for schema, record, and log APIs.

## Open Source Setup

1. Update `wrangler.json` with your own D1 `database_id`.
2. Create a local `.dev.vars` file from `.dev.vars.example`.
3. Put production credentials into Cloudflare secrets instead of `wrangler.json`.
4. Initialize the remote D1 schema before using `/api/schemas`.

## Local Development

```bash
cp .dev.vars.example .dev.vars
pnpm install
pnpm run dev
```

## Remote Secrets

```bash
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_USERNAME
wrangler secret put ADMIN_PASSWORD
```

## D1 Initialization

```bash
pnpm run db:init:remote
```

This runs:

```bash
wrangler d1 execute alien-cms --remote --file=src/db/schema.sql
```
