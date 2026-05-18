# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

The Nuxt app lives in `agora/` — **all `npm` commands run from `agora/`, not the repo root**. The repo root holds deployment artifacts (`helm/`, `deploy_staging.sh`) and operator docs (`docs/`).

```
agora/        Nuxt 4 application (working code)
helm/         Helm chart for K3s deployment (Traefik IngressRoute)
docs/         MIGRATION.md (deploy/runbook), TROUBLESHOOT.md
deploy_staging.sh   One-shot staging deploy script
```

## Commands

All from `agora/`:

```bash
npm install            # also runs `prisma generate && nuxt prepare` via postinstall
npm run dev            # dev server on http://localhost:3000/agora (note base path)
npm run build          # production build (.output/)
npm run preview        # serve production build
npm run lint           # ESLint (stylistic: no trailing comma, 1tbs)
npm run typecheck      # vue-tsc
npm run test:e2e       # Playwright; auto-starts dev server, baseURL is /agora

npx prisma migrate dev # apply migrations locally
npx prisma db seed     # tsx prisma/seed.ts — populates Philosophers
```

**First-time setup must run the seed.** Without it the app boots but has zero philosophers, so every page that lists or routes by philosopher is empty/broken. `prisma migrate dev` does not seed automatically on existing databases.

Run a single Playwright test: `npx playwright test tests/e2e/agora.spec.ts -g "test name"`. Playwright reuses an existing dev server when not in CI.

CI (`.github/workflows/ci.yaml`) runs lint + typecheck then builds the Docker image. There is **no unit test job** — only Playwright e2e, and it is not part of CI as configured. Lint and typecheck must pass.

## Base path quirk

The app is served at **`/agora`** (configurable via `NUXT_PUBLIC_BASE_URL`). Staging uses `/agora/beta`. Hardcoded root-relative URLs (e.g. `/api/...`, `/favicon.png`) will break in production. Use `useRuntimeConfig().public.baseUrl` or relative paths. Playwright's `baseURL` already includes `/agora`.

Socket.IO is the exception: it uses path `/socket.io` and assumes the ingress strips the `/agora` prefix (see `server/plugins/socket.io.ts`).

**Known footgun:** `server/utils/auth.ts:91` falls back to `/agora/beta` (staging path) when `NUXT_PUBLIC_BASE_URL` is unset, instead of `/agora`. This is inconsistent with the rest of the app — if you see avatars 404-ing in production, check this first. Prefer `useRuntimeConfig().public.baseUrl` over `process.env` in server code.

## Architecture

**Single GraphQL endpoint** at `/api/graphql` (`server/api/graphql.ts`) backed by graphql-yoga is the *only* mutation/query surface. The schema (`server/graphql/schema.ts`) and resolvers (`server/graphql/resolvers/{query,mutation,types}.ts`) are the source of truth — when adding a feature, start there, not by creating new REST routes. Frontend talks to it via the `useGraphQL` composable.

The handful of non-GraphQL routes under `server/api/` are intentionally narrow and not extension points: `upload.post.ts` (multipart → MinIO), `img/` (image proxy/transform), `logs.post.ts` (client log ingest → `ClientLog`), `health.ts` (k8s probe).

`server/graphql/resolvers/mutation.ts` is 915 lines and roughly sectioned in this order: auth/registration (~30-180), conversation lifecycle including `sendMessage`/fork/like (~180-700), profile (~700-790), admin + philosopher management (~790-915). Search by mutation name rather than scrolling.

**LLM call flow** (`server/utils/llm.ts` → `server/services/` → `server/providers/`):

1. `CircuitBreaker.isOpen()` short-circuits to canned fallback responses.
2. Per-user rate limit (`rateLimit.ts`, Redis-backed) gates calls.
3. `DISABLE_LLM=true` skips the provider entirely (returns fallback). Used in tests and when no API key is configured.
4. `PromptBuilder` sanitizes input, trims history to `MAX_CONTEXT_CHARS` (12k), builds the philosopher system prompt.
5. `getLLMProvider()` dispatches by `LLM_PROVIDER` (currently only `gemini`). To add a provider, implement the interface in `server/providers/provider.ts` and register in `index.ts`.
6. Errors classified by message: `429`/`quota` → circuit breaker trip; `SAFETY` → polite redirect; everything else → fallback. The user always gets *some* response.

The same module also generates conversation titles and summaries; these are best-effort and silently return `''` on failure.

**Socket.IO** is set up in `server/plugins/socket.io.ts` with a Redis adapter for horizontal scaling. The plugin attaches to the underlying HTTP server lazily on the first request because Nitro doesn't expose the server at plugin-init time. `io` is injected into `event.context` for API routes. Force-websocket-only and `perMessageDeflate: false` are intentional workarounds for proxy behavior — don't revert.

**Startup validation** (`server/plugins/config.ts`) fails the server in production if `NUXT_JWT_SECRET`, `NUXT_DATABASE_URL`, or `NUXT_REDIS_URL` are missing (JWT must be ≥32 chars). Dev mode warns but continues. `NUXT_GEMINI_API_KEY` is required unless `DISABLE_LLM=true`.

**MinIO + image upload flow** (`server/plugins/minio-init.ts`, `server/utils/minio.ts`, `server/services/ImageService.ts`) holds avatars and uploads. Bucket name is configurable; init plugin ensures it exists at boot. The image proxy at `server/api/img/` serves objects through the app so callers don't need direct MinIO access. End-to-end the path is: `ImageInput` component → `useImageUpload` composable → `POST /api/upload` → MinIO → returned URL stored on `User.avatar` (or similar). Don't bypass any link in that chain.

**Prisma schema** (`prisma/schema.prisma`) — key relationships:
- `Conversation` belongs to a `User` and `Philosopher`; can be forked (`forkedFromId` self-relation) and soft-deleted (`deletedAt`); flags `isPublic` and `isAnonymous` are independent.
- **Soft-delete invariant:** every `Conversation` query MUST filter `deletedAt: null` (see existing usage throughout `query.ts`). Mutations that act on a conversation should also check it — e.g. `forkConversation` rejects deleted, but `sendMessage` currently does not (latent bug).
- `Message.role` is enum `user | philosopher` (note lowercase).
- `Comment` is threaded via `parentId` self-relation; both conversations and comments have separate `Like` / `CommentLike` tables (unique on `(userId, target)`).
- `Notification` is denormalized (LIKE / COMMENT / FORK) — write to it when emitting the corresponding action.
- `Role` enum has `USER | MODERATOR | ADMIN`. Admin access is gated at **two layers**: `app/middleware/admin.ts` for routes and `requireAdmin()` (from `server/utils/rbac.ts`) inside resolvers. New admin features need both — middleware alone won't protect direct GraphQL calls.
- **The `Session` table is unused.** Auth is pure JWT (7-day expiry, signed with `NUXT_JWT_SECRET`); `getCurrentUser` reads from `Authorization: Bearer` header or `auth_token` cookie and looks the user up directly. Don't waste time wiring sessions in unless you're actively replacing JWT.
- `PageView` and `ClientLog` exist for analytics/observability; powering the admin Analytics panel.

**Rate limiting** (`server/utils/rateLimit.ts`) is Redis-backed via `getRedisClient()`. If Redis is unreachable it **silently falls back to a per-process in-memory `Map`** — which under the Helm `HorizontalPodAutoscaler` means per-pod buckets, so effective limits multiply by replica count. If you're debugging "rate limit didn't fire as expected", check Redis health first.

## Environment variables

Runtime config is in `nuxt.config.ts` — anything not listed there will not reach the server. Production runtime expects **`NUXT_`-prefixed** vars (Nuxt convention to override `runtimeConfig`); the Helm secret keys are mapped to `NUXT_*` vars in `helm/templates/deployment.yaml`. Local `agora/.env` uses the bare names (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `GEMINI_API_KEY`). See `docs/MIGRATION.md` §3 for the full mapping table.

## Deployment

K3s + Helm + Traefik IngressRoute. Two environments share one cluster:
- `main` branch → namespace `agora`, path `/agora` (production)
- `dev` branch → namespace `agora-staging`, path `/agora/beta` (staging — overrides prod with `ingress.priority: 100`)

`.github/workflows/deploy.yaml` auto-deploys on push. Staging may also be deployed manually with `./deploy_staging.sh` which sources `agora/.env` and runs `helm upgrade --install`.

Staging and prod must use **different sticky-session cookie names** (`agora_sticky` vs `agora_staging_sticky`) or routing breaks. Staging passwords must be hex-only (`openssl rand -hex 12`) to avoid URL-encoding issues in connection strings — see `docs/TROUBLESHOOT.md`.

## Conventions worth knowing

- **ESLint stylistic:** `commaDangle: 'never'`, `braceStyle: '1tbs'`. Husky + lint-staged run `eslint --fix` on commit.
- Composables use the `use*` prefix (`useAuth`, `useGraphQL`, `useImageUpload`, `useHydrationSafeDate`).
- `useHydrationSafeDate` exists specifically to avoid SSR/CSR mismatch on date rendering — prefer it over raw `Date` in templates.
