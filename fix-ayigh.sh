#!/bin/bash
set -e
cd ~/ayigh

echo "=== [1/6] Fixing page.tsx — tabbed mobile layout ==="
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
  ExternalLink, Save, FolderOpen, Trash2, Loader2, GitBranch,
  ChevronDown, ChevronUp, Mic, BarChart2,
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
        <div className="flex items-center gap-2">{icon}
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]">{title}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
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
    try {
      const { data, error } = await loadScripts();
      if (error) toast({ title: 'Supabase', description: error, variant: 'destructive' });
      else setScripts(data);
    } catch {
      toast({ title: 'Offline', description: 'Cloud scripts unavailable — check Supabase keys', variant: 'destructive' });
    }
    setLoadingScripts(false);
  }, []);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const handleSaveScript = async () => {
    const name = `script_${Date.now()}.sh`;
    setSavingScript(true);
    try {
      const { error } = await saveScript(name, '# new script');
      if (error) toast({ title: 'Save Error', description: error, variant: 'destructive' });
      else { toast({ title: 'Script Saved', description: name }); fetchScripts(); }
    } catch {
      toast({ title: 'Offline', description: 'Cannot save', variant: 'destructive' });
    }
    setSavingScript(false);
  };

  const handleDeleteScript = async (id: string) => {
    try {
      const { error } = await deleteScript(id);
      if (error) toast({ title: 'Delete Error', description: error, variant: 'destructive' });
      else setScripts(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'assistant', label: 'AI', icon: <Mic className="w-4 h-4" /> },
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon className="w-4 h-4" /> },
    { id: 'controls', label: 'Controls', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'stats', label: 'Stats', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <HUDHeader />
      <div className="flex border-b border-border/50 bg-secondary/10 shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === t.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <main className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'assistant' && (
          <div style={{ height: 'calc(100vh - 160px)' }}>
            <VoiceAssistant />
          </div>
        )}
        {activeTab === 'terminal' && (
          <div className="flex flex-col gap-3">
            <div style={{ height: '60vh', minHeight: 300 }}>
              <Terminal />
            </div>
            <Section title="Integration" icon={<ExternalLink className="w-3.5 h-3.5 text-accent" />}>
              <div className="p-3 grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1.5 border-primary/20 hover:bg-primary/10"
                  onClick={() => { window.location.href = 'termux://open'; }}>
                  <TerminalIcon className="w-5 h-5 text-primary" />
                  <span className="text-[9px] font-bold uppercase">Open Termux</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1.5 border-accent/20 hover:bg-accent/10"
                  onClick={() => toast({ title: 'Git', description: 'Use terminal: git -C ~/ayigh status' })}>
                  <GitBranch className="w-5 h-5 text-accent" />
                  <span className="text-[9px] font-bold uppercase">GitHub</span>
                </Button>
              </div>
            </Section>
          </div>
        )}
        {activeTab === 'controls' && (
          <div className="space-y-3">
            <Section title="Quick Controls" icon={<Settings2 className="w-3.5 h-3.5 text-primary" />} defaultOpen>
              <QuickControls />
            </Section>
            <Section title="Emergency Hub" icon={<CloudLightning className="w-3.5 h-3.5 text-red-400" />}>
              <EmergencyHub />
            </Section>
            <div className="bg-secondary/10 border border-border/50 rounded-xl p-3 text-[9px] text-muted-foreground space-y-1">
              <p className="text-yellow-400 font-bold">⚠ Controls need Termux relay</p>
              <p>In Termux: <span className="font-code text-primary">node ~/ayigh/termux-relay.js</span></p>
              <p>Then controls will work live.</p>
            </div>
          </div>
        )}
        {activeTab === 'stats' && (
          <div className="space-y-3">
            <Section title="Device Stats" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />} defaultOpen>
              <PhoneStats />
            </Section>
            <Section title="Cloud Scripts" icon={<Database className="w-3.5 h-3.5 text-accent" />} defaultOpen>
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" className="gap-1.5 text-[9px] font-bold uppercase h-8"
                    onClick={handleSaveScript} disabled={savingScript}>
                    {savingScript ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />} Save
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-1.5 text-[9px] font-bold uppercase h-8"
                    onClick={fetchScripts} disabled={loadingScripts}>
                    {loadingScripts ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <FolderOpen className="w-2.5 h-2.5" />} Reload
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase px-1">Recent</div>
                  {scripts.length === 0 && !loadingScripts && (
                    <p className="text-[9px] text-muted-foreground px-1">No scripts yet. Add Supabase keys to .env to enable.</p>
                  )}
                  {scripts.slice(0, 8).map(item => (
                    <div key={item.id} className="p-2 bg-secondary/20 rounded border border-border/50 flex items-center justify-between group">
                      <div>
                        <div className="text-[10px] font-code font-medium truncate max-w-[160px]">{item.name}</div>
                        <div className="text-[8px] text-muted-foreground uppercase">{formatTime(item.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`text-[8px] font-black px-1 py-0.5 rounded ${
                          item.status === 'SUCCESS' ? 'bg-green-500/10 text-green-400'
                          : item.status === 'FAILED' ? 'bg-red-500/10 text-red-400'
                          : 'bg-yellow-500/10 text-yellow-400'
                        }`}>{item.status}</div>
                        <button onClick={() => handleDeleteScript(item.id)}>
                          <Trash2 className="w-2.5 h-2.5 text-muted-foreground hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 hud-border flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-0.5 bg-primary/30 rounded-full animate-pulse" />
              <h4 className="text-[9px] font-black uppercase tracking-widest text-primary">System Integrity</h4>
              <p className="text-[9px] text-muted-foreground">Heartbeat active. All nodes operational.</p>
              <div className="w-12 h-0.5 bg-primary/30 rounded-full animate-pulse" />
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  );
}
EOF

echo "=== [2/6] Fixing supabase.ts — graceful offline handling ==="
cat > src/lib/supabase.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;
EOF

echo "=== [3/6] Fixing workspace.ts — null-safe supabase ==="
cat > src/lib/workspace.ts << 'EOF'
import { supabase } from './supabase';

export interface WorkspaceScript {
  id: string; name: string; content: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING'; created_at: string;
}

export async function saveScript(name: string, content: string): Promise<{ data: WorkspaceScript | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'Supabase not configured' };
  const { data, error } = await supabase.from('workspace_scripts').insert({ name, content, status: 'PENDING' }).select().single();
  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function loadScripts(): Promise<{ data: WorkspaceScript[]; error: string | null }> {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase.from('workspace_scripts').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function updateScriptStatus(id: string, status: 'SUCCESS' | 'FAILED'): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { error } = await supabase.from('workspace_scripts').update({ status }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteScript(id: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' };
  const { error } = await supabase.from('workspace_scripts').delete().eq('id', id);
  return { error: error?.message ?? null };
}
EOF

echo "=== [4/6] Adding TTS via termux-tts-speak fallback to VoiceAssistant ==="
# Patch speak() to try termux-tts first, fall back to Web Speech
cat > src/lib/ai.ts << 'EOF'
export interface Message { role: 'user' | 'assistant'; content: string; }
export interface AIResponse {
  text: string;
  action?: {
    type: 'shell' | 'phone' | 'call' | 'brightness' | 'volume' | 'wifi' | 'git' | 'open_termux';
    payload: string; description: string;
  };
}

const SYSTEM = `You are ayigh, an AI command center assistant running on Android via a Next.js web app connected to Termux. You have access to the user's phone through Termux:API.

You can:
- Answer any question the user has (general knowledge, coding, etc.)
- Generate and explain shell commands (Termux/bash)
- Control phone settings (brightness, volume, Wi-Fi, Bluetooth)
- Access files and directories on the phone
- Make calls and send SMS through Termux:API
- Interact with GitHub repos via git CLI
- Check battery, memory, CPU, storage, Wi-Fi status
- Run code (Node.js, Python, bash) in Termux

When the user wants to DO something on the phone, respond in this exact JSON format:
{
  "text": "Your friendly explanation of what you're about to do",
  "action": {
    "type": "shell" | "phone" | "call" | "brightness" | "volume" | "wifi" | "git" | "open_termux",
    "payload": "the actual command or value",
    "description": "short 2-3 word label for UI button"
  }
}

For pure Q&A with no device action, just respond with plain text.
Be direct, concise, and technical. You are speaking to Alisha who built you.`;

export async function askAI(messages: Message[], userMessage: string): Promise<AIResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('NEXT_PUBLIC_GEMINI_API_KEY not set in .env');

  const history = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [...history, { role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) { const err = await res.text(); throw new Error(`Gemini error: ${err.slice(0, 200)}`); }

  const data = await res.json();
  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const jsonMatch = rawText.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (jsonMatch) {
    try { const p = JSON.parse(jsonMatch[0]); if (p.text && p.action) return p as AIResponse; } catch {}
  }
  try { const p = JSON.parse(rawText.trim()); if (p.text && p.action) return p as AIResponse; } catch {}
  return { text: rawText };
}

export function speak(text: string) {
  if (typeof window === 'undefined') return;
  // Try Web Speech API
  const synth = window.speechSynthesis;
  if (synth) {
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95; utt.pitch = 1.0; utt.volume = 1.0;
    const voices = synth.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha'));
    if (preferred) utt.voice = preferred;
    synth.speak(utt);
    // Check if it actually worked after 500ms
    setTimeout(() => {
      if (!synth.speaking) tryTermuxTTS(text);
    }, 500);
  } else {
    tryTermuxTTS(text);
  }
}

function tryTermuxTTS(text: string) {
  // Fallback: use termux-tts-speak via relay if available
  try {
    const ws = new WebSocket('ws://localhost:8765');
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 'tts', command: `termux-tts-speak "${text.replace(/"/g, '')}"` }));
      setTimeout(() => ws.close(), 5000);
    };
    ws.onerror = () => {}; // silently fail
  } catch {}
}
EOF

echo "=== [5/6] Building ==="
npm run build

echo "=== [6/6] Syncing to Android ==="
npx cap sync android
sed -i 's/VERSION_21/VERSION_17/g' android/app/capacitor.build.gradle
sed -i 's/VERSION_21/VERSION_17/g' android/capacitor-cordova-android-plugins/build.gradle

echo ""
echo "Now run: cd ~/ayigh/android && ./gradlew assembleDebug 2>&1 | tail -10"
