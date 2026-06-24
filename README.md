# V ayigh — AI Command Center

AI-powered HUD dashboard for Android. Runs in browser via Termux, controls your phone through Termux:API.

## What it does

| Feature | How |
|---|---|
| **AI Assistant** | Ask anything — Gemini answers and executes commands |
| **Voice input** | Tap mic, speak, AI interprets and acts |
| **Voice feedback** | AI speaks back via Web Speech API |
| **Real terminal** | Full bash shell via WebSocket relay to Termux |
| **Phone controls** | Brightness, volume, Wi-Fi, torch via Termux:API |
| **Device stats** | Battery, RAM, storage, Wi-Fi — live |
| **Make calls** | AI can dial via `termux-telephony-call` |
| **File access** | ls, find, cat, any shell command |
| **GitHub** | git status/commit/push from terminal or AI |
| **Cloud workspace** | Supabase-backed script storage |

## Setup

### 1. In Termux — install deps + start relay

```bash
pkg install termux-api nodejs git
npm install -g ws

# Clone and install
git clone https://github.com/renaealisha54-debug/Ayigh.git ~/ayigh
cd ~/ayigh && npm install

# Start the relay (keep this running)
node ~/ayigh/termux-relay.js
```

### 2. Termux permissions (Android Settings)

Grant these to Termux:
- `Termux:API` — all permissions
- Phone / Contacts / SMS / Location

### 3. Environment variables

```bash
cp .env.example .env
nano .env  # fill in Supabase + Gemini keys
```

### 4. Supabase table

Run in your Supabase SQL editor:

```sql
create table if not exists workspace_scripts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content text not null default '',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'SUCCESS', 'FAILED')),
  created_at timestamptz not null default now()
);
alter table workspace_scripts enable row level security;
create policy "allow_all" on workspace_scripts
  for all using (true) with check (true);
```

### 5. Run

```bash
npm run dev
# Open http://localhost:9002 in your Android browser
```

## Architecture

```
termux-relay.js          ← WebSocket server inside Termux
    ↕ ws://localhost:8765
src/lib/termux.ts        ← WebSocket client (browser)
src/lib/phone.ts         ← Battery, memory, brightness, calls...
src/lib/github.ts        ← Git operations
src/lib/ai-server.ts     ← Gemini 2.0 Flash server action
src/components/
  voice/VoiceAssistant   ← AI chat + mic + TTS
  terminal/Terminal      ← Real bash terminal via relay
  dashboard/PhoneStats   ← Live device stats
  dashboard/QuickControls← Sliders + toggles with real API calls
```

## Voice command examples

- "What's my battery level?"
- "Set brightness to 60"
- "Open Termux"
- "List files in my downloads"
- "Git push my ayigh project"
- "Check my RAM"
- "Turn on the flashlight"
- "What's 2+2?" / "Explain async/await"

## License

MIT © Alisha
