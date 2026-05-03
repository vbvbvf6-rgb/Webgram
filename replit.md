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
- Mobile bottom navigation (5 tabs: Chats, Search, Calls, Wallet ⚡, Settings)
- 7-tab settings page
- Calls history page
- **Pulsecoins ⚡** in-app currency (wallet, daily bonus, send to users, leaderboard)
- **Polls** (create via /poll or toolbar, vote inline in chat)
- **Stickers** (3 packs: Classic, Animals, Food — emoji-based)
- **GIFs** (curated picker with 12 GIF categories)
- **Chat themes** (7 color themes, per-chat, localStorage persisted)
- **Profile viewer modal** (click any avatar to see full profile)
- **Saved messages** (star any message, view at /saved)
- **Bot commands**: /poll /gif /coin /flip /roll /shrug /me

## Artifacts

### `artifacts/messenger` (web, path: `/`)
React+Vite frontend. Pages:
- `/` → Landing (or redirect to `/chats` if signed in)
- `/sign-in`, `/sign-up` → Clerk auth pages
- `/chats/:chatId?` → Main chat UI (sidebar + chat window)
- `/wallet` → Pulsecoins wallet (balance, transactions, send, leaderboard)
- `/saved` → Saved/starred messages
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
- `GET /api/wallet` — get wallet balance (auto-creates with 100 PC welcome bonus)
- `POST /api/wallet/daily` — claim 50 PC daily bonus
- `POST /api/wallet/send` — send Pulsecoins to another user
- `GET /api/wallet/transactions` — transaction history
- `GET /api/wallet/leaderboard` — top Pulsecoin holders
- `GET /api/chats/:chatId/polls` — list polls in chat
- `POST /api/chats/:chatId/polls` — create poll
- `GET /api/chats/:chatId/polls/:pollId` — get poll with results
- `POST /api/chats/:chatId/polls/:pollId/vote` — vote on poll

## Database Tables

- `users` — Clerk user profiles
- `chats` — chat rooms (DM or group)
- `chat_members` — chat membership
- `messages` — chat messages
- `reactions` — message emoji reactions
- `wallets` — Pulsecoin balances per user
- `transactions` — Pulsecoin transfer history
- `polls` — poll questions and options
- `poll_votes` — per-user poll votes

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
- Poll messages stored as `[poll:ID]` in message content; frontend fetches and renders inline
- Image URL messages auto-render inline if content matches image URL pattern
- Starred/saved messages stored in `localStorage` under `pulse_starred` and `pulse_saved_messages`
- Chat themes stored in `localStorage` under `pulse_theme_${chatId}`
- Pulsecoins: welcome bonus 100 PC on first wallet access, 50 PC daily via POST /api/wallet/daily
- `lib/api-zod/src/index.ts` only exports `./generated/api` (not types or schemas)
- Tailwind uses `tailwindcss({ optimize: false })` in vite.config.ts for Clerk CSS layer compatibility
- CSS starts with `@layer theme, base, clerk, components, utilities;`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
