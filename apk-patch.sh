#!/bin/bash
# Run this inside ~/ayigh on Termux

set -e
cd ~/ayigh

echo "=== [1/5] Patching ai.ts — remove 'use server', use NEXT_PUBLIC key ==="
cat > src/lib/ai.ts << 'EOF'
/**
 * Central AI service — direct Gemini REST API (client-safe, no server needed)
 */

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  action?: {
    type: 'shell' | 'phone' | 'call' | 'brightness' | 'volume' | 'wifi' | 'git' | 'open_termux';
    payload: string;
    description: string;
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

Examples:
- "open terminal" → { "text": "Opening Termux now.", "action": { "type": "open_termux", "payload": "", "description": "Open Termux" } }
- "set brightness 80" → { "text": "Setting brightness to 80%.", "action": { "type": "brightness", "payload": "80", "description": "Set Brightness" } }
- "call mom" → { "text": "Opening the dialer for Mom.", "action": { "type": "call", "payload": "+1234567890", "description": "Call Mom" } }
- "check battery" → { "text": "Checking battery...", "action": { "type": "shell", "payload": "termux-battery-status", "description": "Battery Status" } }
- "git push ayigh" → { "text": "Committing and pushing your changes.", "action": { "type": "git", "payload": "git -C ~/ayigh add -A && git commit -m 'update' && git push", "description": "Push to GitHub" } }
- "list files in downloads" → { "text": "Listing your downloads folder.", "action": { "type": "shell", "payload": "ls -la ~/storage/downloads", "description": "List Downloads" } }

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
    contents: [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Try to parse JSON action block
  const jsonMatch = rawText.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.text && parsed.action) return parsed as AIResponse;
    } catch {}
  }

  // Try whole response as JSON
  try {
    const parsed = JSON.parse(rawText.trim());
    if (parsed.text && parsed.action) return parsed as AIResponse;
  } catch {}

  return { text: rawText };
}

// TTS using browser Web Speech API (no API key needed)
export function speak(text: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  const voices = synth.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen')
  );
  if (preferred) utt.voice = preferred;
  synth.speak(utt);
}
EOF

echo "=== [2/5] Patching VoiceAssistant.tsx — use askAI instead of askAIServer ==="
sed -i "s/import { askAIServer } from '@\/lib\/ai-server';//" src/components/voice/VoiceAssistant.tsx
sed -i "s/import { speak, type Message, type AIResponse } from '@\/lib\/ai';/import { askAI, speak, type Message, type AIResponse } from '@\/lib\/ai';/" src/components/voice/VoiceAssistant.tsx
sed -i "s/const response = await askAIServer(history, text);/const response = await askAI(history, text);/" src/components/voice/VoiceAssistant.tsx

echo "=== [3/5] Patching workspace.ts — remove 'use server', use client-side supabase ==="
cat > src/lib/workspace.ts << 'EOF'
import { supabase } from './supabase';

export interface WorkspaceScript {
  id: string;
  name: string;
  content: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  created_at: string;
}

export async function saveScript(
  name: string,
  content: string
): Promise<{ data: WorkspaceScript | null; error: string | null }> {
  const { data, error } = await supabase
    .from('workspace_scripts')
    .insert({ name, content, status: 'PENDING' })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

export async function loadScripts(): Promise<{
  data: WorkspaceScript[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('workspace_scripts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export async function updateScriptStatus(
  id: string,
  status: 'SUCCESS' | 'FAILED'
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workspace_scripts')
    .update({ status })
    .eq('id', id);

  return { error: error?.message ?? null };
}

export async function deleteScript(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workspace_scripts')
    .delete()
    .eq('id', id);

  return { error: error?.message ?? null };
}
EOF

echo "=== [4/5] Patching next.config.ts — add static export ==="
cat > next.config.ts << 'EOF'
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
    ],
  },
};

export default nextConfig;
EOF

echo "=== [5/5] Updating .env — rename key to NEXT_PUBLIC_ ==="
if [ -f .env ]; then
  sed -i 's/^GEMINI_API_KEY=/NEXT_PUBLIC_GEMINI_API_KEY=/' .env
  echo ".env updated"
else
  echo "WARNING: .env not found — create it manually (see below)"
fi

echo ""
echo "All patches applied. Now run:"
echo "  npm run build"
