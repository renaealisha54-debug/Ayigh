"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Waves, Loader2, Send, User, Bot, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { askAIServer } from '@/lib/ai-server';
import { speak, type Message, type AIResponse } from '@/lib/ai';
import { termuxRun, termuxAPI } from '@/lib/termux';
import { setBrightness, setVolume, makeCall } from '@/lib/phone';

interface ChatMessage extends Message {
  id: string;
  action?: AIResponse['action'];
  executing?: boolean;
}

export function VoiceAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      content: "ayigh online. I can control your phone, run Termux commands, check battery/memory, access files, answer questions, and more. Tap the mic or type.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    const id = Date.now().toString() + Math.random();
    setMessages(prev => [...prev, { ...msg, id }]);
    return id;
  };

  const updateMessage = (id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const executeAction = async (action: AIResponse['action'], msgId: string) => {
    if (!action) return;
    updateMessage(msgId, { executing: true });

    let result = '';
    try {
      switch (action.type) {
        case 'shell': {
          const res = await termuxRun(action.payload);
          result = res.stdout || res.stderr || (res.ok ? 'Done.' : 'Command failed');
          break;
        }
        case 'call': {
          const res = await makeCall(action.payload);
          result = res.error ? `Call failed: ${res.error}` : 'Dialer opened.';
          break;
        }
        case 'brightness': {
          const res = await setBrightness(parseInt(action.payload));
          result = res.error ? `Failed: ${res.error}` : `Brightness set to ${action.payload}%`;
          break;
        }
        case 'volume': {
          const res = await setVolume(parseInt(action.payload));
          result = res.error ? `Failed: ${res.error}` : `Volume set to ${action.payload}%`;
          break;
        }
        case 'wifi': {
          const on = action.payload === 'on';
          const res = await termuxAPI.wifiEnable(on);
          result = res.ok ? `Wi-Fi ${on ? 'enabled' : 'disabled'}` : res.stderr;
          break;
        }
        case 'git': {
          const res = await termuxRun(action.payload);
          result = res.stdout || res.stderr || 'Git operation complete.';
          break;
        }
        case 'open_termux': {
          window.location.href = 'termux://open';
          result = 'Opening Termux...';
          break;
        }
        case 'phone': {
          const res = await termuxRun(action.payload);
          result = res.stdout || res.stderr || 'Done.';
          break;
        }
      }
    } catch (e: any) {
      result = `Error: ${e.message}`;
    }

    if (result) {
      addMessage({ role: 'assistant', content: `↳ ${result}` });
      if (ttsEnabled) speak(result.slice(0, 200));
    }
    updateMessage(msgId, { executing: false });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return;
    setInput('');

    const userMsgId = addMessage({ role: 'user', content: text });
    setIsThinking(true);

    try {
      // Build context for AI
      const history: Message[] = messages
        .filter(m => m.id !== 'init')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await askAIServer(history, text);

      const assistantId = addMessage({
        role: 'assistant',
        content: response.text,
        action: response.action,
      });

      if (ttsEnabled) speak(response.text);

      // Auto-execute if action present
      if (response.action) {
        await executeAction(response.action, assistantId);
      }
    } catch (e: any) {
      addMessage({ role: 'assistant', content: `Error: ${e.message}` });
    } finally {
      setIsThinking(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: 'Not supported', description: 'Speech recognition unavailable in this browser' });
      return;
    }
    const rec = new SpeechRecognition();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      sendMessage(text);
    };
    rec.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return (
    <div className="flex flex-col h-full bg-secondary/10 border border-primary/10 rounded-xl hud-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-secondary/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-[0.15em]">ayigh Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled(v => !v)}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
          >
            {ttsEnabled
              ? <Volume2 className="w-3.5 h-3.5 text-primary" />
              : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <button
            onClick={() => setMessages([{ id: 'init', role: 'assistant', content: 'Conversation cleared. Ready.' }])}
            className="p-1.5 rounded hover:bg-white/5 transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-accent/20' : 'bg-primary/20'}`}>
              {msg.role === 'user'
                ? <User className="w-3 h-3 text-accent" />
                : <Bot className="w-3 h-3 text-primary" />}
            </div>
            <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : ''}`}>
              <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent/20 text-accent-foreground rounded-tr-sm'
                  : 'bg-secondary/40 text-foreground rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
              {msg.action && (
                <button
                  onClick={() => executeAction(msg.action, msg.id)}
                  disabled={msg.executing}
                  className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 rounded-full hover:bg-primary/20 transition-colors text-primary disabled:opacity-50"
                >
                  {msg.executing
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    : <span>▶</span>}
                  {msg.action.description || msg.action.type}
                </button>
              )}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex gap-2">
            <div className="p-1.5 rounded-full bg-primary/20">
              <Bot className="w-3 h-3 text-primary" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-secondary/40 rounded-tl-sm flex items-center gap-1">
              <span className="w-1 h-1 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/50 bg-secondary/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isThinking}
            className={`p-2.5 rounded-full transition-all shrink-0 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-primary/20 text-primary hover:bg-primary/30'
            }`}
          >
            {isListening ? <Waves className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            className="flex-1 bg-secondary/30 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
            placeholder="Ask anything or give a command..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            disabled={isListening || isThinking}
          />

          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isThinking || isListening}
            className="p-2.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-all disabled:opacity-40 shrink-0"
          >
            {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
