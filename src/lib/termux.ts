/**
 * Termux API Bridge
 * 
 * All real device interactions happen via Termux:API intents fired from
 * the in-browser terminal through deep-links or the Termux:Widget API.
 * Since Next.js runs in the browser on Android (served via Termux), we
 * can reach Termux:API via the `termux-` CLI tools through a WebSocket
 * relay server that you run inside Termux itself.
 *
 * SETUP (run once in Termux):
 *   pkg install termux-api nodejs
 *   npx wscat --listen 8765   # or use the relay server below
 *
 * The relay server (termux-relay.js) accepts JSON messages and runs
 * the corresponding termux-* command, streaming stdout back.
 */

export interface TermuxResult {
  stdout: string;
  stderr: string;
  ok: boolean;
}

let ws: WebSocket | null = null;
let pending: Map<string, (r: TermuxResult) => void> = new Map();

function getWS(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) return resolve(ws);
    try {
      const socket = new WebSocket('ws://localhost:8765');
      socket.onopen = () => { ws = socket; resolve(socket); };
      socket.onerror = () => reject(new Error('Termux relay not running. Start termux-relay.js first.'));
      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const cb = pending.get(msg.id);
          if (cb) { pending.delete(msg.id); cb(msg); }
        } catch {}
      };
      socket.onclose = () => { ws = null; };
    } catch (e) {
      reject(e);
    }
  });
}

export async function termuxRun(command: string): Promise<TermuxResult> {
  try {
    const socket = await getWS();
    const id = Math.random().toString(36).slice(2);
    return new Promise((resolve) => {
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, command }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ stdout: '', stderr: 'Timeout waiting for Termux relay', ok: false });
        }
      }, 15000);
    });
  } catch (e: any) {
    return { stdout: '', stderr: e.message, ok: false };
  }
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export const termuxAPI = {
  battery:    () => termuxRun('termux-battery-status'),
  brightness: (v: number) => termuxRun(`termux-brightness ${v}`),
  volume:     (stream: string, v: number) => termuxRun(`termux-volume ${stream} ${v}`),
  wifi:       () => termuxRun('termux-wifi-connectioninfo'),
  wifiEnable: (on: boolean) => termuxRun(`termux-wifi-enable ${on}`),
  cellInfo:   () => termuxRun('termux-telephony-cellinfo'),
  call:       (number: string) => termuxRun(`termux-telephony-call ${number}`),
  sms:        (num: string, msg: string) => termuxRun(`termux-sms-send -n ${num} "${msg}"`),
  contacts:   () => termuxRun('termux-contact-list'),
  location:   () => termuxRun('termux-location -p gps'),
  clipboard:  (text: string) => termuxRun(`echo "${text.replace(/"/g, '\\"')}" | termux-clipboard-set`),
  vibrate:    (ms: number) => termuxRun(`termux-vibrate -d ${ms}`),
  notification: (title: string, content: string) =>
    termuxRun(`termux-notification --title "${title}" --content "${content}"`),
  torch:      (on: boolean) => termuxRun(`termux-torch ${on ? 'on' : 'off'}`),
  tts:        (text: string) => termuxRun(`termux-tts-speak "${text.replace(/"/g, '\\"')}"`),
  deviceInfo: async () => {
    const [battery, wifi, cell] = await Promise.all([
      termuxRun('termux-battery-status'),
      termuxRun('termux-wifi-connectioninfo'),
      termuxRun('cat /proc/meminfo'),
    ]);
    return { battery, wifi, cell };
  },
};
