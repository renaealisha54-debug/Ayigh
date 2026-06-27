export interface Message { role: 'user' | 'assistant'; content: string; }
export interface AIResponse {
  text: string;
  action?: {
    type: 'shell' | 'brightness' | 'volume' | 'wifi' | 'call' | 'git' | 'open_termux';
    payload: string;
    description: string;
  };
}

const SYSTEM = `You are ayigh, a phone control assistant on Android with Termux access.
You ONLY handle phone control tasks. Always respond with this JSON when doing something:
{"text":"doing X","action":{"type":"shell","payload":"termux command here","description":"label"}}

What you can do:
- Brightness: termux-brightness 0-255
- Volume: termux-volume music 0-15
- Torch: termux-torch on/off
- Battery: termux-battery-status
- WiFi info: termux-wifi-connectioninfo
- Call: termux-telephony-call +1234567890
- SMS: termux-sms-send -n +1234567890 "message"
- List files: ls ~/storage/downloads
- Open file: termux-open ~/storage/downloads/file.pdf
- Open app: am start -n com.package.name/.MainActivity
- Save text to file: echo "content" > ~/storage/downloads/file.txt
- Open Termux: {"type":"open_termux","payload":"","description":"Open Termux"}
- Git push: git -C ~/ayigh add -A && git commit -m "update" && git push

If the user asks something unrelated to phone control, reply: "I only handle phone control tasks."`;

export async function askAI(messages: Message[], userMessage: string): Promise<AIResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey) throw new Error('Add NEXT_PUBLIC_GROQ_API_KEY to .env');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [
        { role: 'system', content: SYSTEM },
        ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: userMessage },
      ],
      max_tokens: 256,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message ?? 'Request failed');
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
    const utt = new SpeechSynthesisUtterance(text.slice(0, 200));
    utt.rate = 1.0; utt.pitch = 1.0; utt.volume = 1.0;
    synth.speak(utt);
  }
}
