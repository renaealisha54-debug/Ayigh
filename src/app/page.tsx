"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { HUDHeader } from '@/components/dashboard/HUDHeader';
import { Terminal } from '@/components/terminal/Terminal';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import { QuickControls, EmergencyHub } from '@/components/dashboard/QuickControls';
import { PhoneStats } from '@/components/dashboard/PhoneStats';
import {
  Database, Terminal as TerminalIcon, Settings2, CloudLightning,
  ExternalLink, Save, FolderOpen, Trash2, Loader2, GitBranch, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { saveScript, loadScripts, deleteScript } from '@/lib/workspace';
import type { WorkspaceScript } from '@/lib/workspace';

export default function Home() {
  const [scripts, setScripts] = useState<WorkspaceScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);
  const [savingScript, setSavingScript] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const fetchScripts = useCallback(async () => {
    setLoadingScripts(true);
    const { data, error } = await loadScripts();
    if (error) toast({ title: 'Load Error', description: error, variant: 'destructive' });
    else setScripts(data);
    setLoadingScripts(false);
  }, []);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  const handleSaveScript = async () => {
    const name = `script_${Date.now()}.sh`;
    setSavingScript(true);
    const { error } = await saveScript(name, '# new script');
    if (error) toast({ title: 'Save Error', description: error, variant: 'destructive' });
    else { toast({ title: 'Script Saved', description: name }); fetchScripts(); }
    setSavingScript(false);
  };

  const handleDeleteScript = async (id: string) => {
    const { error } = await deleteScript(id);
    if (error) toast({ title: 'Delete Error', description: error, variant: 'destructive' });
    else setScripts(prev => prev.filter(s => s.id !== id));
  };

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <HUDHeader />

      <main className="flex-1 p-3 grid grid-cols-12 gap-3 overflow-hidden">
        {/* ── Left: AI Assistant ── */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 overflow-hidden">
          {/* VoiceAssistant takes the bulk of left column */}
          <div className="flex-1 min-h-0">
            <VoiceAssistant />
          </div>

          {/* Controls panel — scrollable */}
          <div className="bg-secondary/10 border border-border/50 rounded-xl hud-border overflow-hidden shrink-0">
            <div className="p-3 border-b border-border/50 flex items-center gap-2 bg-secondary/20">
              <Settings2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]">Controls</span>
            </div>
            <div className="overflow-y-auto max-h-64">
              <QuickControls />
              <EmergencyHub />
            </div>
          </div>
        </div>

        {/* ── Center: Terminal + Integration ── */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-3 overflow-hidden">
          {/* Terminal — main real estate */}
          <div className="flex-1 min-h-0">
            <Terminal />
          </div>

          {/* Relay setup instructions */}
          <div className="bg-secondary/10 border border-border/50 rounded-xl hud-border overflow-hidden shrink-0">
            <div className="p-3 border-b border-border/50 flex items-center justify-between bg-secondary/20">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">Integration</span>
              </div>
              <button
                onClick={() => setShowSetup(v => !v)}
                className="text-[9px] text-muted-foreground hover:text-foreground uppercase font-bold tracking-wider"
              >
                {showSetup ? 'Hide' : 'Setup Guide'}
              </button>
            </div>
            {showSetup ? (
              <div className="p-4 font-code text-[10px] text-muted-foreground space-y-2 leading-5">
                <p className="text-primary font-bold">▶ Run this in Termux to enable full device control:</p>
                <pre className="bg-black/30 p-2 rounded text-[9px] overflow-x-auto">
{`# 1. Install deps (once)
pkg install termux-api nodejs

# 2. Copy relay file to home
cp ~/ayigh/termux-relay.js ~/

# 3. Install ws module
npm install -g ws

# 4. Start the relay
node ~/termux-relay.js

# Keep this running — it powers the terminal
# and all phone controls.`}
                </pre>
                <p className="text-[9px] text-yellow-400">Also grant: Termux:API permissions in Android settings.</p>
              </div>
            ) : (
              <div className="p-3 grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-16 flex flex-col items-center justify-center gap-1.5 border-primary/20 hover:bg-primary/10 group"
                  onClick={() => { window.location.href = 'termux://open'; }}
                >
                  <TerminalIcon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-bold uppercase">Open Termux</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-16 flex flex-col items-center justify-center gap-1.5 border-accent/20 hover:bg-accent/10 group"
                  onClick={() => toast({ title: 'Git', description: 'Use terminal: git -C ~/ayigh status' })}
                >
                  <GitBranch className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-bold uppercase">GitHub</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Device Stats + Cloud Workspace ── */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-3 overflow-y-auto pb-2">
          <PhoneStats />

          {/* Cloud Workspace */}
          <div className="bg-secondary/10 border border-border/50 rounded-xl hud-border overflow-hidden">
            <div className="p-3 border-b border-border/50 flex items-center justify-between bg-secondary/20">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-accent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]">Cloud Scripts</span>
              </div>
              {loadingScripts && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary"
                  className="gap-1.5 text-[9px] font-bold uppercase h-8"
                  onClick={handleSaveScript} disabled={savingScript}
                >
                  {savingScript ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
                  Save
                </Button>
                <Button size="sm" variant="secondary"
                  className="gap-1.5 text-[9px] font-bold uppercase h-8"
                  onClick={fetchScripts} disabled={loadingScripts}
                >
                  <FolderOpen className="w-2.5 h-2.5" /> Reload
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="text-[9px] font-bold text-muted-foreground uppercase px-1">Recent</div>
                {scripts.length === 0 && !loadingScripts && (
                  <p className="text-[9px] text-muted-foreground px-1">No scripts yet.</p>
                )}
                {scripts.slice(0, 8).map(item => (
                  <div key={item.id}
                    className="p-2 bg-secondary/20 rounded border border-border/50 flex items-center justify-between group cursor-pointer hover:bg-secondary/30 transition-colors"
                  >
                    <div>
                      <div className="text-[10px] font-code font-medium truncate max-w-[100px]">{item.name}</div>
                      <div className="text-[8px] text-muted-foreground uppercase">{formatTime(item.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`text-[8px] font-black px-1 py-0.5 rounded ${
                        item.status === 'SUCCESS' ? 'bg-green-500/10 text-green-400'
                        : item.status === 'FAILED' ? 'bg-red-500/10 text-red-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                      }`}>{item.status}</div>
                      <button
                        onClick={() => handleDeleteScript(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-2.5 h-2.5 text-muted-foreground hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* System integrity pulse */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 hud-border flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-0.5 bg-primary/30 rounded-full animate-pulse" />
            <h4 className="text-[9px] font-black uppercase tracking-widest text-primary">System Integrity</h4>
            <p className="text-[9px] text-muted-foreground">Heartbeat active. All nodes operational.</p>
            <div className="w-12 h-0.5 bg-primary/30 rounded-full animate-pulse" />
          </div>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
