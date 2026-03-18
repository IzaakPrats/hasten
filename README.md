# Hasten

**Multi-threaded AI conversation** — A chat interface powered by Claude (Anthropic) with support for branching sub-threads on specific parts of assistant responses. Stream responses, persist conversations in PostgreSQL, and drill into sections with follow-up threads.

---

## Features

- **Conversations** — Create and switch between multiple chats; each has a configurable model (default: `claude-sonnet-4-6`).
- **Streaming** — Real-time SSE streaming of assistant replies with structured sections (text, code, etc.).
- **Sub-threads** — Open follow-up threads on any section of a message; each thread has its own context (parent summary + section content) and message history.
- **Persistence** — Conversations, messages, sections, and sub-threads stored in PostgreSQL via Prisma.
- **UI** — shadcn-based UI, theme support (light/dark/system), code blocks with Shiki highlighting, and a sidebar for conversation list.

---

## Tech stack

| Layer        | Tech |
|-------------|------|
| Framework   | Next.js 15 (App Router, Turbopack in dev) |
| UI          | React 19, Tailwind CSS, shadcn/ui (Radix), Lucide icons |
| State       | Zustand |
| API / AI    | Anthropic SDK (Claude), custom SSE streaming |
| Database    | PostgreSQL, Prisma ORM |
| Code highlight | Shiki |

---

## Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm/yarn
- **PostgreSQL** (local or hosted, e.g. [Neon](https://neon.tech))

---

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd new
pnpm install
```

`postinstall` runs `prisma generate` automatically.

### 2. Environment variables

Copy the example env and set your values:

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:password@host/dbname?sslmode=require` for Neon). |
| `ANTHROPIC_API_KEY` | Your [Anthropic API key](https://console.anthropic.com/) for Claude. |

### 3. Database

Apply migrations and (optionally) seed:

```bash
pnpm prisma migrate deploy
# or for a fresh dev DB:
pnpm prisma migrate dev
```

### 4. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects `/` to `/chat`; new conversations start from `/chat`, and each chat has its own URL `/chat/[id]`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server with Turbopack. |
| `pnpm build` | Production build. |
| `pnpm start` | Start production server (run after `pnpm build`). |
| `pnpm lint` | Run ESLint. |
| `pnpm postinstall` | Generates Prisma client (runs after `pnpm install`). |

Prisma CLI is available via `pnpm prisma` (e.g. `pnpm prisma migrate dev`, `pnpm prisma studio`).

---

## Project structure

```
├── app/
│   ├── api/
│   │   ├── conversations/          # List conversations, create, get one, get messages
│   │   ├── conversations/[id]/     # Get/update conversation, get messages
│   │   ├── sections/[sectionId]/threads/  # Create sub-thread for a section
│   │   └── threads/[id]/           # Get thread, POST messages (streaming)
│   ├── chat/
│   │   ├── [id]/page.tsx           # Single conversation view
│   │   ├── page.tsx                # New chat / conversation list
│   │   └── loading.tsx
│   ├── layout.tsx
│   ├── page.tsx                    # Redirects to /chat
│   └── globals.css
├── components/
│   ├── chat/                       # Message list, input, sections, code blocks, sub-thread panel
│   ├── layout/                     # Sidebar, header
│   ├── ui/                         # shadcn components
│   └── theme-provider.tsx
├── hooks/
│   └── use-sse-stream.ts           # SSE streaming for main conversation
├── lib/
│   ├── anthropic.ts                # Claude client
│   ├── db.ts                       # Prisma client
│   ├── stream.ts                   # Main conversation streaming + section parsing
│   ├── stream-subthread.ts         # Sub-thread streaming
│   ├── section-parser.ts           # Parse streamed sections
│   ├── prompts.ts                  # System prompts
│   ├── title.ts / summary.ts       # Generation helpers
│   ├── types.ts
│   └── utils.ts
├── stores/
│   └── chat.ts                     # Zustand store (conversations, messages, UI state)
├── prisma/
│   └── schema.prisma               # Conversation, Message, Section, SubThread, SubThreadMessage
└── public/
```

---

## Database schema (overview)

- **Conversation** — Title, model, timestamps; has many Messages.
- **Message** — Role, content, token counts; belongs to Conversation; has many Sections.
- **Section** — Type, title, content, order; belongs to Message; has many SubThreads.
- **SubThread** — Optional title, parent summary; belongs to Section; has many SubThreadMessages.
- **SubThreadMessage** — Role, content, token counts; belongs to SubThread.

Sub-threads are created from a section; the assistant in a sub-thread receives context (parent summary + section content) plus the thread’s message history.

---

## Development

- **UI** — Use shadcn for all UI components; implement happy-path UX.
- **React** — Prefer avoiding `useEffect` where possible (e.g. data loading in event handlers or server components).
- **Conventions** — See `AGENTS.md` for project rules used by AI assistants.

---

## License

Private. All rights reserved.
