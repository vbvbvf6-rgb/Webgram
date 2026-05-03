# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack Telegram-inspired messenger app called **Pulse**.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (ClerkProvider + @clerk/express)
- **Frontend**: React + Vite, Tailwind CSS v4, framer-motion, lucide-react, wouter
- **State**: @tanstack/react-query with generated hooks from Orval

## Project: Pulse Messenger

A Telegram-inspired real-time messaging app with:
- Dark indigo/violet theme (background: `222 47% 8%`, primary: `258 84% 68%`)
- Sign in / sign up with Clerk (Google + email)
- Direct messages and group chats
- Message reactions (emoji) with categorized picker (7 emoji categories)
- Reply threads, edit & delete messages
- Rich text rendering: **bold**, _italic_, `code`, auto-linked URLs
- Voice messages (MediaRecorder API → base64 stored, full waveform player)
- Image sharing via URL (auto-renders inline images)
- Typing indicators (polling-based, bouncing dots animation)
- Pinned messages (per-chat, click banner to scroll to message)
- Message forwarding (forward to any other chat)
- Starred/bookmarked messages (localStorage, yellow star badge)
- Copy message to clipboard
- Voice/video calls (WebRTC getUserMedia, full call UI)
- User search and discovery
- Online presence indicators
- Unread message tracking
- Chat stats in sidebar
- Mobile bottom navigation (fixed, spring animation)
- 7-tab settings page
- Calls history page

## Artifacts

### `artifacts/messenger` (web, path: `/`)
React+Vite frontend. Pages:
- `/` → Landing (or redirect to `/chats` if signed in)
- `/sign-in`, `/sign-up` → Clerk auth pages
- `/chats/:chatId?` → Main chat UI (sidebar + chat window)
- `/settings` → Profile settings (7 tabs)
- `/search` → User discovery
- `/calls` → Call history

### `artifacts/api-server` (api, path: `/api`)
Express backend. Routes:
- `GET /api/healthz`
- `GET/PUT /api/users/me`
- `GET /api/users/search?q=`
- `GET /api/users/online`
- `GET /api/chats/stats`
- `GET/POST /api/chats`
- `GET /api/chats/:chatId`
- `GET/POST /api/chats/:chatId/members`
- `POST/GET /api/chats/:chatId/typing` (in-memory, 4s TTL)
- `GET/POST /api/chats/:chatId/pin` (in-memory per-chat pinned message)
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`
- `PUT /api/chats/:chatId/messages/:messageId`
- `DELETE /api/chats/:chatId/messages/:messageId`
- `POST /api/chats/:chatId/messages/:messageId/react`
- `POST /api/chats/:chatId/messages/:messageId/read`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- `ensureUser(clerkId)` uses `INSERT ... ON CONFLICT DO UPDATE` to avoid race conditions
- Clerk auth tokens are attached via `setAuthTokenGetter` using `useAuth().getToken()`
- Messages poll every 3 seconds for real-time feel (`refetchInterval: 3000`)
- Typing indicators poll every 2s via direct fetch with Clerk token
- Voice messages stored as `[voice:DURATION_SECS:base64_dataurl]` in message content
- Image URL messages auto-render inline if content matches image URL pattern
- Starred messages stored in `localStorage` under `pulse_starred`
- `lib/api-zod/src/index.ts` only exports `./generated/api` (not types or schemas)
- Tailwind uses `tailwindcss({ optimize: false })` in vite.config.ts for Clerk CSS layer compatibility
- CSS starts with `@layer theme, base, clerk, components, utilities;`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
