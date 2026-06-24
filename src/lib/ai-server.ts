'use server';

import { type Message, type AIResponse } from './ai';

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

export async function askAIServer(
  messages: Message[],
  userMessage: string
): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

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

  // Try to parse JSON action
  const jsonMatch = rawText.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.text && parsed.action) return parsed as AIResponse;
    } catch {}
  }

  // Also try if the whole response is JSON
  try {
    const parsed = JSON.parse(rawText.trim());
    if (parsed.text && parsed.action) return parsed as AIResponse;
  } catch {}

  return { text: rawText };
}
