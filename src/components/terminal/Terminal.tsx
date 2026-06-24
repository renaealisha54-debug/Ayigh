"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, ChevronRight, X, Maximize2, Minus, Wifi, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { termuxRun } from '@/lib/termux';

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  ts?: string;
}

const BOOT = [
  { type: 'system' as const, content: 'AYIGH OS v4.2.0 [INITIALIZING...]' },
  { type: 'system' as const, content: 'Connecting to Termux relay on ws://localhost:8765...' },
  { type: 'system' as const, content: 'Type "help" for commands or enter any shell command.' },
];

const BUILTINS: Record<string, string[]> = {
  help: [
    'Built-in: help, clear, status, relay-check',
    'Shell:    Any bash / termux-* command',
    'Examples: ls ~/ayigh | cat /proc/meminfo | termux-battery-status',
    '          git -C ~/ayigh status | python3 -c "print(1+1)"',
  ],
  status: [
    'System: ONLINE',
    'AI Engine: Gemini 2.0 Flash',
    'Relay: ws://localhost:8765',
    'Encryption: TLS',
  ],
};

export function Terminal() {
  const [lines, setLines] = useState<TerminalLine[]>(BOOT);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [relayConnected, setRelayConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines]);

  // Check relay connection on mount
  useEffect(() => {
    (async () => {
      const res = await termuxRun('echo relay-ok');
      setRelayConnected(res.ok && res.stdout.includes('relay-ok'));
    })();
  }, []);

  const addLines = useCallback((newLines: TerminalLine[]) => {
    setLines(prev => [...prev, ...newLines]);
  }, []);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    setHistory(h => [cmd, ...h.slice(0, 49)]);
    setHistIdx(-1);
    setInput('');

    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    addLines([{ type: 'input', content: cmd, ts }]);

    if (cmd === 'clear') { setLines([{ type: 'system', content: 'Buffer cleared.' }]); return; }
    if (cmd === 'relay-check') {
      const r = await termuxRun('echo relay-ok');
      addLines([{ type: r.ok ? 'system' : 'error', content: r.ok ? '✓ Relay connected' : '✗ Relay offline — start termux-relay.js in Termux' }]);
      setRelayConnected(r.ok);
      return;
    }
    if (BUILTINS[cmd]) {
      addLines(BUILTINS[cmd].map(c => ({ type: 'output' as const, content: c })));
      return;
    }

    // Run through Termux relay
    addLines([{ type: 'system', content: '▶ Running...' }]);
    const result = await termuxRun(cmd);
    const out: TerminalLine[] = [];
    if (result.stdout) {
      result.stdout.trim().split('\n').forEach(l => out.push({ type: 'output', content: l }));
    }
    if (result.stderr) {
      result.stderr.trim().split('\n').forEach(l => out.push({ type: 'error', content: l }));
    }
    if (!result.stdout && !result.stderr) {
      out.push({ type: 'system', content: result.ok ? '(no output)' : 'Command failed' });
    }
    addLines(out);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(next);
      setInput(history[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(histIdx - 1, -1);
      setHistIdx(next);
      setInput(next === -1 ? '' : history[next] ?? '');
    }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(lines.map(l => l.content).join('\n'));
  };

  return (
    <div
      className="flex flex-col h-full bg-[#080810] border border-primary/20 rounded-lg overflow-hidden terminal-glow hud-border"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/40 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-primary" />
          <span className="text-xs font-headline font-semibold tracking-wider text-muted-foreground uppercase">
            ayigh Terminal
          </span>
          <div className={cn(
            "w-1.5 h-1.5 rounded-full ml-1",
            relayConnected ? "bg-green-400" : "bg-red-400"
          )} title={relayConnected ? 'Relay connected' : 'Relay offline'} />
        </div>
        <div className="flex gap-1">
          <button onClick={copyAll} className="p-1 hover:bg-white/5 rounded" title="Copy all">
            <Copy className="w-3 h-3 text-muted-foreground" />
          </button>
          <button onClick={() => setLines(BOOT)} className="p-1 hover:bg-white/5 rounded" title="Clear">
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </button>
          <button className="p-1 hover:bg-white/5 rounded"><Minus className="w-3 h-3 text-muted-foreground" /></button>
          <button className="p-1 hover:bg-white/5 rounded"><Maximize2 className="w-3 h-3 text-muted-foreground" /></button>
          <button className="p-1 hover:bg-white/5 rounded"><X className="w-3 h-3 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Output */}
      <div ref={scrollRef} className="flex-1 p-3 font-code text-xs overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-primary/20">
        {lines.map((line, i) => (
          <div key={i} className={cn(
            "flex gap-2 leading-5",
            line.type === 'error'   ? "text-red-400" :
            line.type === 'system'  ? "text-primary/70 font-bold" :
            line.type === 'input'   ? "text-accent" : "text-foreground/90"
          )}>
            {line.type === 'input'  && <span className="text-primary opacity-60 shrink-0">$</span>}
            {line.type === 'system' && <span className="opacity-40 shrink-0">[!]</span>}
            {line.type === 'error'  && <span className="opacity-60 shrink-0">[E]</span>}
            <span className="break-all whitespace-pre-wrap">{line.content}</span>
            {line.ts && line.type === 'input' && (
              <span className="ml-auto text-[9px] text-muted-foreground/40 shrink-0">{line.ts}</span>
            )}
          </div>
        ))}

        {/* Input row */}
        <div className="flex items-center gap-2 pt-1">
          <ChevronRight className="w-3 h-3 text-accent shrink-0" />
          <form onSubmit={handleCommand} className="flex-1">
            <input
              ref={inputRef}
              autoFocus
              className="w-full bg-transparent border-none outline-none text-accent font-code text-xs placeholder:text-muted-foreground/30"
              placeholder={relayConnected ? "Enter command..." : "Start termux-relay.js — then type here"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
