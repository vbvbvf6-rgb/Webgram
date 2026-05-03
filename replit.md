# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack Telegram-inspired messenger app called **Droidgram**.

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
- **AI**: OpenRouter via Replit AI Integrations — DeepSeek (`deepseek/deepseek-chat-v3.1`)

## Project: Droidgram Messenger

A Telegram-inspired real-time messaging app with:
- Dark indigo/violet theme (`#0b1020` bg, `bg-fuchsia-500` accent)
- Sign in / sign up with Clerk (Google + email)
- Direct messages and group chats
- Message reactions (emoji) with categorized picker
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
- Mobile bottom navigation (5 tabs: Chats, Search, AI, Wallet ⚡, Settings)
- 7-tab settings page
- Calls history page
- **Pulsecoins ⚡** in-app currency (wallet, daily bonus, send to users, leaderboard)
- **Polls** (create via /poll or toolbar, vote inline in chat)
- **Stickers** (emoji-based packs)
- **Chat themes** (8 color themes, per-chat, localStorage persisted)
- **Profile viewer modal** (click any avatar to see full profile)
- **Saved messages** (star any message, view at /saved)
- **Bot commands**: /poll /gif /coin /flip /roll /shrug /me
- **Animated gifts** (8 types: rose/star/fire/rocket/crown/rainbow/diamond/trophy)
- **Per-tab browser sessions** (each tab has independent auth state via sessionStorage)
- **E2EE** (per-tab ephemeral key pair, X25519 ECDH for DMs, group key derivation)
- **Droidgram AI bot** (DeepSeek via OpenRouter, streaming SSE, per-user conversation history, content moderation)
- **Phone number verification** (optional, OTP-based UI in settings)

## Artifacts

### `artifacts/messenger` (web, path: `/`)
React+Vite frontend. Pages:
- `/` → Landing (or redirect to `/chats` if signed in)
- `/sign-in`, `/sign-up` → Clerk auth pages
- `/chats/:chatId?` → Main chat UI (sidebar + chat window)
- `/ai` → Droidgram AI bot chat (DeepSeek, streaming, moderation)
- `/wallet` → Pulsecoins wallet (balance, transactions, send, leaderboard)
- `/saved` → Saved/starred messages
- `/settings` → Profile settings (7 tabs, phone verification)
- `/search` → User discovery
- `/calls` → Call history

### `artifacts/api-server` (api, path: `/api`)
Express backend. Routes:
- `GET /api/healthz`
- `GET/PUT /api/users/me` (supports phone, phoneVerified fields)
- `GET /api/users/search?q=`
- `GET /api/users/online`
- `GET /api/chats/stats`
- `GET/POST /api/chats`
- `GET /api/chats/:chatId`
- `GET/POST /api/chats/:chatId/members`
- `POST/GET /api/chats/:chatId/typing`
- `GET/POST /api/chats/:chatId/pin`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`
- `PUT /api/chats/:chatId/messages/:messageId`
- `DELETE /api/chats/:chatId/messages/:messageId`
- `POST /api/chats/:chatId/messages/:messageId/react`
- `POST /api/chats/:chatId/messages/:messageId/read`
- `GET /api/wallet`
- `POST /api/wallet/daily`
- `POST /api/wallet/send`
- `GET /api/wallet/transactions`
- `GET /api/wallet/leaderboard`
- `POST /api/wallet/gift`
- `GET/POST /api/chats/:chatId/polls`
- `GET /api/chats/:chatId/polls/:pollId`
- `POST /api/chats/:chatId/polls/:pollId/vote`
- `GET /api/ai/conversation` — get/create AI conversation for current user
- `DELETE /api/ai/conversation` — clear AI conversation history
- `POST /api/ai/chat` — stream AI response (SSE) using DeepSeek
- `POST /api/ai/moderate` — content safety check (returns {safe, reason, severity})

## Database Tables

- `users` — Clerk user profiles (+ phone, phoneVerified)
- `chats` — chat rooms (DM or group)
- `chat_members` — chat membership
- `messages` — chat messages
- `wallets` — Pulsecoin balances per user
- `transactions` — Pulsecoin transfer history
- `polls` — poll questions and options
- `poll_votes` — per-user poll votes
- `ai_conversations` — per-user AI conversation threads
- `ai_messages` — AI conversation messages (role: user/assistant)

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
- Per-tab sessions: `sessionStorage` key `pulse_tab_logged_out` controls per-tab auth; `setTabLoggedOut()` exported from App.tsx
- E2EE keys stored in sessionStorage with tabId suffix; group key derived from sorted member IDs
- AI model: `deepseek/deepseek-chat-v3.1` via OpenRouter (env: AI_INTEGRATIONS_OPENROUTER_BASE_URL, AI_INTEGRATIONS_OPENROUTER_API_KEY)
- AI moderation: content safety check on every user message before sending; dangerous content blocked with UI warning
- Phone verification: OTP simulation (code shown in toast for demo; real SMS would need Twilio)
- `lib/api-zod/src/index.ts` only exports `./generated/api` (not types or schemas)
- Tailwind uses `tailwindcss({ optimize: false })` in vite.config.ts for Clerk CSS layer compatibility
- CSS starts with `@layer theme, base, clerk, components, utilities;`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
