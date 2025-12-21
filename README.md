# whiteboard-lm

a spatial canvas for llm conversations with branching. think mind map meets chat interface.

## what it does

- create chat cards anywhere on an infinite pan/zoom canvas
- have conversations with gpt-4o-mini in each card
- highlight any assistant response and branch it into a new linked thread
- visual edges show the relationship between parent and child threads
- everything persists to supabase

## setup

### 1. clone and install

```bash
cd whiteboard-lm
npm install
```

### 2. set up supabase

1. create a new project at [supabase.com](https://supabase.com)
2. go to the sql editor and run the migration in `supabase/migrations/001_initial_schema.sql`
3. grab your project url and anon key from project settings > api

### 3. environment variables

copy the example and fill in your values:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-your-openai-key
```

### 4. run it

```bash
npm run dev
```

open [http://localhost:3000](http://localhost:3000)

## how to use

1. sign up / log in
2. you'll land on your canvases page (one is auto-created for you)
3. click a canvas to open it
4. double-click anywhere on the canvas to create a chat card
5. type messages and get streaming responses
6. highlight text in an assistant response → click "branch" to spawn a linked thread
7. drag cards around to organize your thinking

## stack

- next.js 14 (app router)
- react flow for the canvas
- supabase for auth + database
- openai gpt-4o-mini for chat
- zustand for state
- tailwind for styling

## todo (future versions)

- [ ] minimap for large canvases
- [ ] prompt/persona presets
- [ ] keyboard shortcuts
- [ ] card collapse/expand
- [ ] delete cards
- [ ] dark mode
- [ ] mobile optimization
