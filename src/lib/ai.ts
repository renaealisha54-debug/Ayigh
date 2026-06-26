export interface Message { role: 'user' | 'assistant'; content: string; }
export interface AIResponse {
  text: string;
  action?: {
    type: 'shell' | 'phone' | 'call' | 'brightness' | 'volume' | 'wifi' | 'git' | 'open_termux';
    payload: string;
    description: string;
  };
}

const SYSTEM = `You are ayigh, an AI command center assistant running on Android via a Next.js web app connected to Termux. When the user wants to DO something on the phone, respond ONLY with this JSON:
{"text":"what you are doing","action":{"type":"shell"|"brightness"|"volume"|"wifi"|"call"|"git"|"open_termux","payload":"command or value","description":"2-3 word label"}}
Examples:
- "check battery" → {"text":"Checking battery.","action":{"type":"shell","payload":"termux-battery-status","description":"Battery Status"}}
- "torch on" → {"text":"Turning torch on.","action":{"type":"shell","payload":"termux-torch on","description":"Torch On"}}
- "open termux" → {"text":"Opening Termux.","action":{"type":"open_termux","payload":"","description":"Open Termux"}}
For pure questions, just reply with plain text. Be concise. You are speaking to Alisha who built you.`;

export async function askAI(messages: Message[], userMessage: string): Promise<AIResponse> {
  const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Add NEXT_PUBLIC_OPENROUTER_API_KEY to your .env file');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ayigh.app',
      'X-Title': 'V Ayigh',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: SYSTEM },
        ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: userMessage },
      ],
      max_tokens: 512,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message ?? 'OpenRouter request failed');
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? '';

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
  }
}
