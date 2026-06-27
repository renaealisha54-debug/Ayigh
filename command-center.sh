#!/bin/bash
set -e
cd ~/ayigh

echo "=== [1/4] Rewriting page.tsx — pure command center, no AI ==="
cat > src/app/page.tsx << 'PAGEOF'
"use client"

import React, { useState, useEffect, useRef } from 'react';
import { HUDHeader } from '@/components/dashboard/HUDHeader';
import { QuickControls, EmergencyHub } from '@/components/dashboard/QuickControls';
import { PhoneStats } from '@/components/dashboard/PhoneStats';
import {
  Terminal as TerminalIcon, Settings2, BarChart2, ChevronDown, ChevronUp,
  Send, Trash2, FolderOpen, MessageSquare, Phone, Zap, Wifi,
  Sun, Volume2, Smartphone, FileText, Save, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { saveScript, loadScripts, deleteScript } from '@/lib/workspace';
import type { WorkspaceScript } from '@/lib/workspace';

type Tab = 'commands' | 'controls' | 'files' | 'stats';

interface CmdResult { cmd: string; output: string; ok: boolean; ts: string; }

const WS_URL = 'ws://localhost:8765';

function useRelay() {
  const ws = useRef<WebSocket | null>(null);
  const pending = useRef<Map<string, (r: { output: string; error?: string }) => void>>(new Map());

  const connect = () => {
    try {
      ws.current = new WebSocket(WS_URL);
      ws.current.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          const cb = pending.current.get(d.id);
          if (cb) { cb(d); pending.current.delete(d.id); }
        } catch {}
      };
      ws.current.onerror = () => {};
    } catch {}
  };

  useEffect(() => { connect(); return () => ws.current?.close(); }, []);

  const run = (cmd: string): Promise<string> => new Promise((resolve) => {
    const id = Date.now().toString(36);
    const timeout = setTimeout(() => {
      pending.current.delete(id);
      resolve('Relay not running. Start: node ~/ayigh/termux-relay.js');
    }, 8000);

    pending.current.set(id, (r) => {
      clearTimeout(timeout);
      resolve(r.output || r.error || 'Done');
    });

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ id, command: cmd }));
    } else {
      connect();
      setTimeout(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ id, command: cmd }));
        } else {
          clearTimeout(timeout);
          pending.current.delete(id);
          resolve('Relay offline. Run: node ~/ayigh/termux-relay.js');
        }
      }, 1000);
    }
  });

  return { run };
}

function Section({ title, icon, children, defaultOpen = false }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-secondary/10 border border-border/50 rounded-xl overflow-hidden">
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

function CmdButton({ label, icon, cmd, run, onResult }: {
  label: string; icon: React.ReactNode; cmd: string;
  run: (c: string) => Promise<string>; onResult: (r: CmdResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const exec = async () => {
    setLoading(true);
    const output = await run(cmd);
    onResult({ cmd, output, ok: !output.toLowerCase().includes('error'), ts: new Date().toLocaleTimeString() });
    setLoading(false);
  };
  return (
    <button onClick={exec} disabled={loading}
      className="flex flex-col items-center justify-center gap-1.5 p-3 bg-secondary/20 hover:bg-primary/10 border border-border/50 hover:border-primary/30 rounded-xl transition-all active:scale-95 disabled:opacity-50">
      {loading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : icon}
      <span className="text-[9px] font-bold uppercase tracking-wide text-center leading-tight">{label}</span>
    </button>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('commands');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<CmdResult[]>([]);
  const [running, setRunning] = useState(false);
  const [scripts, setScripts] = useState<WorkspaceScript[]>([]);
  const [fileInput, setFileInput] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileResult, setFileResult] = useState('');
  const { run } = useRelay();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadScripts().then(r => setScripts(r.data)); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  const addResult = (r: CmdResult) => setHistory(h => [...h.slice(-30), r]);

  const execCmd = async (cmd: string) => {
    if (!cmd.trim()) return;
    setRunning(true);
    const output = await run(cmd.trim());
    addResult({ cmd: cmd.trim(), output, ok: !output.toLowerCase().includes('error'), ts: new Date().toLocaleTimeString() });
    setRunning(false);
    setInput('');
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'commands', label: 'Commands', icon: <TerminalIcon className="w-4 h-4" /> },
    { id: 'controls', label: 'Controls', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'files', label: 'Files', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'stats', label: 'Stats', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  const quickCmds = [
    { label: 'Battery', icon: <Zap className="w-5 h-5 text-yellow-400" />, cmd: 'termux-battery-status' },
    { label: 'WiFi Info', icon: <Wifi className="w-5 h-5 text-blue-400" />, cmd: 'termux-wifi-connectioninfo' },
    { label: 'Storage', icon: <Smartphone className="w-5 h-5 text-purple-400" />, cmd: 'df -h ~/storage' },
    { label: 'Processes', icon: <BarChart2 className="w-5 h-5 text-green-400" />, cmd: 'ps aux | head -20' },
    { label: 'Torch On', icon: <Zap className="w-5 h-5 text-orange-400" />, cmd: 'termux-torch on' },
    { label: 'Torch Off', icon: <Zap className="w-5 h-5 text-muted-foreground" />, cmd: 'termux-torch off' },
    { label: 'Downloads', icon: <FolderOpen className="w-5 h-5 text-accent" />, cmd: 'ls ~/storage/downloads' },
    { label: 'Memory', icon: <BarChart2 className="w-5 h-5 text-pink-400" />, cmd: 'free -h' },
  ];

  const appCmds = [
    { label: 'Camera', icon: <Smartphone className="w-5 h-5 text-blue-400" />, cmd: 'am start -a android.media.action.IMAGE_CAPTURE' },
    { label: 'Settings', icon: <Settings2 className="w-5 h-5 text-gray-400" />, cmd: 'am start -a android.settings.SETTINGS' },
    { label: 'Browser', icon: <Zap className="w-5 h-5 text-orange-400" />, cmd: 'am start -a android.intent.action.VIEW -d https://google.com' },
    { label: 'Gallery', icon: <FileText className="w-5 h-5 text-pink-400" />, cmd: 'am start -a android.intent.action.VIEW -t image/*' },
    { label: 'Maps', icon: <Smartphone className="w-5 h-5 text-green-400" />, cmd: 'am start -a android.intent.action.VIEW -d geo:0,0' },
    { label: 'Dialer', icon: <Phone className="w-5 h-5 text-green-400" />, cmd: 'am start -a android.intent.action.DIAL' },
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

      <main className="flex-1 overflow-y-auto">

        {/* COMMANDS TAB */}
        {activeTab === 'commands' && (
          <div className="flex flex-col h-full p-3 gap-3">
            <Section title="Quick Actions" icon={<Zap className="w-3.5 h-3.5 text-yellow-400" />} defaultOpen>
              <div className="p-2 grid grid-cols-4 gap-2">
                {quickCmds.map(c => (
                  <CmdButton key={c.label} label={c.label} icon={c.icon} cmd={c.cmd} run={run} onResult={addResult} />
                ))}
              </div>
            </Section>

            <Section title="Open Apps" icon={<Smartphone className="w-3.5 h-3.5 text-blue-400" />}>
              <div className="p-2 grid grid-cols-3 gap-2">
                {appCmds.map(c => (
                  <CmdButton key={c.label} label={c.label} icon={c.icon} cmd={c.cmd} run={run} onResult={addResult} />
                ))}
              </div>
            </Section>

            <Section title="Send SMS" icon={<MessageSquare className="w-3.5 h-3.5 text-green-400" />}>
              <SMSPanel run={run} onResult={addResult} />
            </Section>

            <Section title="Make Call" icon={<Phone className="w-3.5 h-3.5 text-green-400" />}>
              <CallPanel run={run} onResult={addResult} />
            </Section>

            {/* Output */}
            <div className="bg-black/50 border border-border/50 rounded-xl p-3 min-h-[100px] max-h-[200px] overflow-y-auto font-code text-[10px] space-y-2">
              {history.length === 0 && (
                <p className="text-muted-foreground">Output will appear here...</p>
              )}
              {history.map((r, i) => (
                <div key={i}>
                  <div className="text-primary">$ {r.cmd}</div>
                  <div className={r.ok ? 'text-green-400' : 'text-red-400'}>{r.output.slice(0, 300)}</div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Command input */}
            <div className="flex gap-2 shrink-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && execCmd(input)}
                placeholder="Type any command..."
                className="flex-1 bg-secondary/20 border border-border/50 rounded-lg px-3 py-2 text-[11px] font-code text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
              <Button size="sm" onClick={() => execCmd(input)} disabled={running || !input.trim()}
                className="h-full px-3">
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* CONTROLS TAB */}
        {activeTab === 'controls' && (
          <div className="p-3 space-y-3">
            <Section title="System Controls" icon={<Settings2 className="w-3.5 h-3.5 text-primary" />} defaultOpen>
              <QuickControls />
            </Section>
            <Section title="Emergency" icon={<Zap className="w-3.5 h-3.5 text-red-400" />}>
              <EmergencyHub />
            </Section>
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-yellow-400 font-bold">⚠ Relay required</p>
              <p className="text-[9px] font-code text-primary">node ~/ayigh/termux-relay.js</p>
            </div>
          </div>
        )}

        {/* FILES TAB */}
        {activeTab === 'files' && (
          <div className="p-3 space-y-3">
            <Section title="Browse & Run" icon={<FolderOpen className="w-3.5 h-3.5 text-accent" />} defaultOpen>
              <div className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Downloads', cmd: 'ls ~/storage/downloads' },
                    { label: 'Home', cmd: 'ls ~/' },
                    { label: 'Pictures', cmd: 'ls ~/storage/pictures' },
                    { label: 'Music', cmd: 'ls ~/storage/music' },
                    { label: 'Ayigh Dir', cmd: 'ls ~/ayigh/src' },
                    { label: 'Disk Usage', cmd: 'du -sh ~/storage/*' },
                  ].map(c => (
                    <CmdButton key={c.label} label={c.label}
                      icon={<FolderOpen className="w-4 h-4 text-accent" />}
                      cmd={c.cmd} run={run} onResult={r => setFileResult(r.output)} />
                  ))}
                </div>
                <div className="bg-black/50 rounded-lg p-2 min-h-[80px] max-h-[150px] overflow-y-auto font-code text-[10px] text-green-400 whitespace-pre-wrap">
                  {fileResult || 'File listing appears here...'}
                </div>
              </div>
            </Section>

            <Section title="Read File" icon={<FileText className="w-3.5 h-3.5 text-primary" />}>
              <div className="p-3 space-y-2">
                <input value={fileInput} onChange={e => setFileInput(e.target.value)}
                  placeholder="~/storage/downloads/file.txt"
                  className="w-full bg-secondary/20 border border-border/50 rounded-lg px-3 py-2 text-[11px] font-code focus:outline-none focus:border-primary/50" />
                <Button size="sm" className="w-full" onClick={async () => {
                  const out = await run(`cat "${fileInput}"`);
                  setFileContent(out);
                }}>Read File</Button>
                <div className="bg-black/50 rounded-lg p-2 min-h-[60px] max-h-[120px] overflow-y-auto font-code text-[10px] text-foreground whitespace-pre-wrap">
                  {fileContent || 'File content appears here...'}
                </div>
              </div>
            </Section>

            <Section title="Delete File" icon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}>
              <DeletePanel run={run} onResult={r => toast({ title: r.ok ? 'Deleted' : 'Error', description: r.output.slice(0,100), variant: r.ok ? 'default' : 'destructive' })} />
            </Section>

            <Section title="Save Scripts" icon={<Save className="w-3.5 h-3.5 text-accent" />}>
              <div className="p-3 space-y-2">
                {scripts.slice(0,5).map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-lg border border-border/50">
                    <span className="text-[10px] font-code truncate flex-1">{s.name}</span>
                    <button onClick={async () => { await deleteScript(s.id); setScripts(p => p.filter(x => x.id !== s.id)); }}>
                      <Trash2 className="w-3 h-3 text-red-400 ml-2" />
                    </button>
                  </div>
                ))}
                {scripts.length === 0 && <p className="text-[9px] text-muted-foreground">No saved scripts.</p>}
              </div>
            </Section>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="p-3 space-y-3">
            <Section title="Device Stats" icon={<BarChart2 className="w-3.5 h-3.5 text-primary" />} defaultOpen>
              <PhoneStats />
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

function SMSPanel({ run, onResult }: { run: (c: string) => Promise<string>; onResult: (r: CmdResult) => void }) {
  const [num, setNum] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const send = async () => {
    if (!num || !msg) return;
    setLoading(true);
    const out = await run(`termux-sms-send -n "${num}" "${msg}"`);
    onResult({ cmd: `SMS to ${num}`, output: out || 'Sent', ok: true, ts: new Date().toLocaleTimeString() });
    setMsg(''); setLoading(false);
  };
  return (
    <div className="p-3 space-y-2">
      <input value={num} onChange={e => setNum(e.target.value)} placeholder="+1234567890"
        className="w-full bg-secondary/20 border border-border/50 rounded-lg px-3 py-2 text-[11px] font-code focus:outline-none focus:border-primary/50" />
      <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Message..."
        className="w-full bg-secondary/20 border border-border/50 rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-primary/50" />
      <Button size="sm" className="w-full gap-2" onClick={send} disabled={loading || !num || !msg}>
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />} Send SMS
      </Button>
    </div>
  );
}

function CallPanel({ run, onResult }: { run: (c: string) => Promise<string>; onResult: (r: CmdResult) => void }) {
  const [num, setNum] = useState('');
  const [loading, setLoading] = useState(false);
  const call = async () => {
    if (!num) return;
    setLoading(true);
    const out = await run(`termux-telephony-call "${num}"`);
    onResult({ cmd: `Call ${num}`, output: out || 'Calling...', ok: true, ts: new Date().toLocaleTimeString() });
    setLoading(false);
  };
  return (
    <div className="p-3 space-y-2">
      <input value={num} onChange={e => setNum(e.target.value)} placeholder="+1234567890"
        className="w-full bg-secondary/20 border border-border/50 rounded-lg px-3 py-2 text-[11px] font-code focus:outline-none focus:border-primary/50" />
      <Button size="sm" className="w-full gap-2" onClick={call} disabled={loading || !num}>
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />} Call
      </Button>
    </div>
  );
}

function DeletePanel({ run, onResult }: { run: (c: string) => Promise<string>; onResult: (r: CmdResult) => void }) {
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const del = async () => {
    if (!path) return;
    setLoading(true);
    const out = await run(`rm -f "${path}"`);
    onResult({ cmd: `rm ${path}`, output: out || 'Deleted', ok: !out.includes('error'), ts: new Date().toLocaleTimeString() });
    setPath(''); setLoading(false);
  };
  return (
    <div className="p-3 space-y-2">
      <input value={path} onChange={e => setPath(e.target.value)} placeholder="~/storage/downloads/file.txt"
        className="w-full bg-secondary/20 border border-border/50 rounded-lg px-3 py-2 text-[11px] font-code focus:outline-none focus:border-primary/50" />
      <Button size="sm" variant="destructive" className="w-full gap-2" onClick={del} disabled={loading || !path}>
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete File
      </Button>
    </div>
  );
}
PAGEOF

echo "=== [2/4] Removing AI deps from package.json ==="
npm uninstall @google/generative-ai 2>/dev/null || true

echo "=== [3/4] Building ==="
npm run build

echo "=== [4/4] Syncing ==="
npx cap sync android
sed -i 's/VERSION_21/VERSION_17/g' android/app/capacitor.build.gradle
sed -i 's/VERSION_21/VERSION_17/g' android/capacitor-cordova-android-plugins/build.gradle

echo ""
echo "Done! Now run: cd ~/ayigh/android && ./gradlew assembleDebug 2>&1 | tail -10"
