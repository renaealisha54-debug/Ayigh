#!/bin/bash
set -e
cd ~/ayigh

echo "=== [1/7] Removing Supabase entirely ==="
npm uninstall @supabase/supabase-js 2>/dev/null || true

echo "=== [2/7] Rewriting workspace.ts — localStorage, no backend ==="
cat > src/lib/workspace.ts << 'EOF'
/**
 * Workspace — local storage only, no backend needed
 */

export interface WorkspaceScript {
  id: string;
  name: string;
  content: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  created_at: string;
}

const KEY = 'ayigh_scripts';

function load(): WorkspaceScript[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch { return []; }
}

function save(scripts: WorkspaceScript[]) {
  localStorage.setItem(KEY, JSON.stringify(scripts));
}

export async function saveScript(name: string, content: string): Promise<{ data: WorkspaceScript | null; error: string | null }> {
  const scripts = load();
  const entry: WorkspaceScript = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name, content, status: 'PENDING',
    created_at: new Date().toISOString(),
  };
  scripts.unshift(entry);
  save(scripts);
  return { data: entry, error: null };
}

export async function loadScripts(): Promise<{ data: WorkspaceScript[]; error: string | null }> {
  return { data: load(), error: null };
}

export async function updateScriptStatus(id: string, status: 'SUCCESS' | 'FAILED'): Promise<{ error: string | null }> {
  const scripts = load().map(s => s.id === id ? { ...s, status } : s);
  save(scripts);
  return { error: null };
}

export async function deleteScript(id: string): Promise<{ error: string | null }> {
  save(load().filter(s => s.id !== id));
  return { error: null };
}

export async function saveScriptWithContent(name: string, content: string): Promise<{ data: WorkspaceScript | null; error: string | null }> {
  return saveScript(name, content);
}
EOF

echo "=== [3/7] Rewriting ai.ts — direct Gemini, no server ==="
cat > src/lib/ai.ts << 'EOF'
export interface Message { role: 'user' | 'assistant'; content: string; }
export interface AIResponse {
  text: string;
  action?: {
    type: 'shell' | 'phone' | 'call' | 'brightness' | 'volume' | 'wifi' | 'git' | 'open_termux';
    payload: string;
    description: string;
  };
}

const SYSTEM = `You are ayigh, an AI command center assistant running on Android via a Next.js web app connected to Termux.

You can control the phone through Termux:API. When the user wants to DO something, respond ONLY with this JSON:
{
  "text": "what you are doing",
  "action": {
    "type": "shell" | "brightness" | "volume" | "wifi" | "call" | "git" | "open_termux",
    "payload": "command or value",
    "description": "2-3 word label"
  }
}

Examples:
- "open termux" → {"text":"Opening Termux.","action":{"type":"open_termux","payload":"","description":"Open Termux"}}
- "check battery" → {"text":"Checking battery.","action":{"type":"shell","payload":"termux-battery-status","description":"Battery Status"}}
- "set brightness 80" → {"text":"Setting brightness to 80%.","action":{"type":"brightness","payload":"80","description":"Set Brightness"}}
- "torch on" → {"text":"Turning torch on.","action":{"type":"shell","payload":"termux-torch on","description":"Torch On"}}
- "git push" → {"text":"Pushing changes.","action":{"type":"git","payload":"git -C ~/ayigh add -A && git commit -m 'update' && git push","description":"Git Push"}}
- "list downloads" → {"text":"Listing downloads.","action":{"type":"shell","payload":"ls ~/storage/downloads","description":"List Downloads"}}

For pure questions with no device action, just reply with plain text. Be concise. You are speaking to Alisha who built you.`;

export async function askAI(messages: Message[], userMessage: string): Promise<AIResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Add NEXT_PUBLIC_GEMINI_API_KEY to your .env file');

  const history = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message ?? 'Gemini request failed');
  }

  const data = await res.json();
  const raw: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Try to parse JSON action
  const match = raw.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (match) { try { const p = JSON.parse(match[0]); if (p.text && p.action) return p; } catch {} }
  try { const p = JSON.parse(raw.trim()); if (p.text && p.action) return p; } catch {}
  return { text: raw };
}

export function speak(text: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (synth) {
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text.slice(0, 300));
    utt.rate = 0.95; utt.pitch = 1.0; utt.volume = 1.0;
    const preferred = synth.getVoices().find(v => v.name.includes('Google') || v.name.includes('Samantha'));
    if (preferred) utt.voice = preferred;
    synth.speak(utt);
    setTimeout(() => { if (!synth.speaking) tryTermuxTTS(text); }, 600);
  } else {
    tryTermuxTTS(text);
  }
}

function tryTermuxTTS(text: string) {
  try {
    const ws = new WebSocket('ws://localhost:8765');
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 'tts', command: `termux-tts-speak "${text.replace(/"/g, '').slice(0, 200)}"` }));
      setTimeout(() => ws.close(), 6000);
    };
    ws.onerror = () => {};
  } catch {}
}
EOF

echo "=== [4/7] Removing ai-server.ts dependency ==="
cat > src/lib/ai-server.ts << 'EOF'
// Stub — all AI calls now go through src/lib/ai.ts directly (client-side)
export {};
EOF

echo "=== [5/7] Patching VoiceAssistant.tsx — use askAI ==="
# Replace askAIServer import with askAI
sed -i "s/import { askAIServer } from '@\/lib\/ai-server';//" src/components/voice/VoiceAssistant.tsx
sed -i "s/import { speak, type Message, type AIResponse } from '@\/lib\/ai';/import { askAI, speak, type Message, type AIResponse } from '@\/lib\/ai';/" src/components/voice/VoiceAssistant.tsx
sed -i "s/const response = await askAIServer(history, text);/const response = await askAI(history, text);/" src/components/voice/VoiceAssistant.tsx

echo "=== [6/7] Rewriting page.tsx — tabbed, no backend refs ==="
cat > src/app/page.tsx << 'EOF'
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { HUDHeader } from '@/components/dashboard/HUDHeader';
import { Terminal } from '@/components/terminal/Terminal';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import { QuickControls, EmergencyHub } from '@/components/dashboard/QuickControls';
import { PhoneStats } from '@/components/dashboard/PhoneStats';
import {
  Database, Terminal as TerminalIcon, Settings2, CloudLightning,
  Save, FolderOpen, Trash2, Loader2, GitBranch,
  ChevronDown, ChevronUp, Mic, BarChart2, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { saveScript, loadScripts, deleteScript } from '@/lib/workspace';
import type { WorkspaceScript } from '@/lib/workspace';

type Tab = 'assistant' | 'terminal' | 'controls' | 'stats';

function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-secondary/10 border border-border/50 rounded-xl hud-border overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full p-3 flex items-center justify-between bg-secondary/20 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]">{title}</span>
        </div>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('assistant');
  const [scripts, setScripts] = useState<WorkspaceScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [savingScript, setSavingScript] = useState(false);

  const fetchScripts = useCallback(async () => {
    setLoadingScripts(true);
    const { data } = await loadScripts();
    setScripts(data);
    setLoadingScripts(false);
  }, []);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const handleSave = async () => {
    const name = `script_${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.sh`;
    setSavingScript(true);
    await saveScript(name, '#!/bin/bash\n# new script\n');
    toast({ title: 'Saved', description: name });
    await fetchScripts();
    setSavingScript(false);
  };

  const handleDelete = async (id: string) => {
    await deleteScript(id);
    setScripts(prev => prev.filter(s => s.id !== id));
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'assistant', label: 'AI', icon: <Mic className="w-4 h-4" /> },
    { id: 'terminal', label: 'Term', icon: <TerminalIcon className="w-4 h-4" /> },
    { id: 'controls', label: 'Controls', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'stats', label: 'Stats', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <HUDHeader />

      {/* Tab bar */}
      <div className="flex border-b border-border/50 bg-secondary/10 shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === t.id
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* AI TAB */}
        {activeTab === 'assistant' && (
          <div style={{ height: 'calc(100vh - 165px)' }}>
            <VoiceAssistant />
          </div>
        )}

        {/* TERMINAL TAB */}
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-3">
            <div style={{ height: '58vh', minHeight: 280 }}>
              <Terminal />
            </div>
            <Section title="Quick Links" icon={<ExternalLink className="w-3.5 h-3.5 text-accent" />}>
              <div className="p-3 grid grid-cols-2 gap-3">
                <Button variant="outline"
                  className="h-14 flex flex-col items-center justify-center gap-1 border-primary/20 hover:bg-primary/10"
                  onClick={() => { window.location.href = 'termux://open'; }}>
                  <TerminalIcon className="w-4 h-4 text-primary" />
                  <span className="text-[9px] font-bold uppercase">Open Termux</span>
                </Button>
                <Button variant="outline"
                  className="h-14 flex flex-col items-center justify-center gap-1 border-accent/20 hover:bg-accent/10"
                  onClick={() => toast({ title: 'Git Push', description: 'Ask AI: "git push ayigh"' })}>
                  <GitBranch className="w-4 h-4 text-accent" />
                  <span className="text-[9px] font-bold uppercase">GitHub</span>
                </Button>
              </div>
            </Section>
          </div>
        )}

        {/* CONTROLS TAB */}
        {activeTab === 'controls' && (
          <div className="space-y-3">
            <Section title="Quick Controls" icon={<Settings2 className="w-3.5 h-3.5 text-primary" />} defaultOpen>
              <QuickControls />
            </Section>
            <Section title="Emergency Hub" icon={<CloudLightning className="w-3.5 h-3.5 text-red-400" />}>
              <EmergencyHub />
            </Section>
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-yellow-400 font-bold">⚠ Relay required for controls</p>
              <p className="text-[9px] text-muted-foreground font-code">node ~/ayigh/termux-relay.js</p>
              <p className="text-[9px] text-muted-foreground">Run this in Termux to enable brightness, torch, Wi-Fi.</p>
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            <Section title="Device Stats" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />} defaultOpen>
              <PhoneStats />
            </Section>

            <Section title="Saved Scripts" icon={<Database className="w-3.5 h-3.5 text-accent" />} defaultOpen>
              <div className="p-3 space-y-3">
                <p className="text-[9px] text-muted-foreground">Stored locally on device — no account needed.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary"
                    className="gap-1.5 text-[9px] font-bold uppercase h-8"
                    onClick={handleSave} disabled={savingScript}>
                    {savingScript ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
                    New Script
                  </Button>
                  <Button size="sm" variant="secondary"
                    className="gap-1.5 text-[9px] font-bold uppercase h-8"
                    onClick={fetchScripts} disabled={loadingScripts}>
                    {loadingScripts ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <FolderOpen className="w-2.5 h-2.5" />}
                    Refresh
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {scripts.length === 0 && (
                    <p className="text-[9px] text-muted-foreground text-center py-4">No scripts saved yet.</p>
                  )}
                  {scripts.slice(0, 10).map(item => (
                    <div key={item.id}
                      className="p-2.5 bg-secondary/20 rounded-lg border border-border/50 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-code truncate pr-2">{item.name}</div>
                        <div className="text-[8px] text-muted-foreground">{formatTime(item.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                          item.status === 'SUCCESS' ? 'bg-green-500/10 text-green-400'
                          : item.status === 'FAILED' ? 'bg-red-500/10 text-red-400'
                          : 'bg-yellow-500/10 text-yellow-400'
                        }`}>{item.status}</span>
                        <button onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-400 transition-colors" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-px bg-primary/40 animate-pulse" />
              <p className="text-[9px] font-black uppercase tracking-widest text-primary">System Integrity</p>
              <p className="text-[9px] text-muted-foreground">Heartbeat active. All nodes operational.</p>
              <div className="w-10 h-px bg-primary/40 animate-pulse" />
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
EOF

echo "=== [7/7] Cleaning .env — removing supabase keys ==="
if [ -f .env ]; then
  grep -v "SUPABASE" .env > .env.tmp && mv .env.tmp .env
  echo ".env cleaned"
fi

echo ""
echo "All done. Now run:"
echo "  npm run build"
