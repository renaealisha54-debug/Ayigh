/**
 * Central AI service — direct Gemini REST API
 * Handles: Q&A, command interpretation, phone control, file ops, GitHub
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
- Answer any question the user has
- Generate and explain shell commands (Termux/bash)
- Control phone settings (brightness, volume, Wi-Fi, Bluetooth)
- Access files and directories on the phone
- Make calls and send SMS through Termux:API
- Interact with GitHub repos via git CLI
- Check battery, memory, CPU, storage, Wi-Fi status
- Run code (Node.js, Python, bash) in Termux

When the user wants to DO something on the phone, respond in this exact JSON format:
{
  "text": "Your friendly explanation of what you're doing",
  "action": {
    "type": "shell" | "phone" | "call" | "brightness" | "volume" | "wifi" | "git" | "open_termux",
    "payload": "the actual command or value",
    "description": "short label for UI"
  }
}

For shell commands: type = "shell", payload = full bash command
For calls: type = "call", payload = phone number  
For brightness 0-100: type = "brightness", payload = "75"
For volume 0-100: type = "volume", payload = "50"
For git operations: type = "git", payload = "git -C ~/ayigh add -A && git commit -m 'update' && git push"
For opening Termux app: type = "open_termux", payload = ""

For pure Q&A with no device action needed, just respond with plain text — no JSON needed.

Be concise, direct, and technical. You are speaking to your creator who built you.`;

export async function askAI(messages: Message[], userMessage: string): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

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
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Try to parse as action JSON
  const jsonMatch = rawText.match(/\{[\s\S]*"action"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.text && parsed.action) return parsed as AIResponse;
    } catch {}
  }

  return { text: rawText };
}

// Server action wrapper
'use server';
export async function askAIAction(
  messages: Message[],
  userMessage: string
): Promise<AIResponse> {
  return askAI(messages, userMessage);
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
  // Try to find a good voice
  const voices = synth.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Karen')
  );
  if (preferred) utt.voice = preferred;
  synth.speak(utt);
}
