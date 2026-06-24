/**
 * Phone capabilities — wraps Termux API calls into high-level helpers.
 * All functions return { data, error } so the UI can handle failures gracefully.
 */

import { termuxRun, termuxAPI } from './termux';

export interface BatteryStatus {
  health: string;
  percentage: number;
  plugged: string;
  status: string;
  temperature: number;
}

export interface MemInfo {
  totalMB: number;
  freeMB: number;
  availableMB: number;
  usedMB: number;
  usedPct: number;
}

export interface WifiInfo {
  ssid: string;
  ip: string;
  rssi: number;
  link_speed_mbps: number;
}

// ── Battery ───────────────────────────────────────────────────────────────────
export async function getBattery(): Promise<{ data: BatteryStatus | null; error: string | null }> {
  const res = await termuxAPI.battery();
  if (!res.ok) return { data: null, error: res.stderr };
  try {
    return { data: JSON.parse(res.stdout), error: null };
  } catch {
    return { data: null, error: 'Failed to parse battery data' };
  }
}

// ── Memory ────────────────────────────────────────────────────────────────────
export async function getMemInfo(): Promise<{ data: MemInfo | null; error: string | null }> {
  const res = await termuxRun('cat /proc/meminfo');
  if (!res.ok) return { data: null, error: res.stderr };
  const lines = res.stdout.split('\n');
  const parse = (key: string) => {
    const line = lines.find(l => l.startsWith(key));
    return line ? parseInt(line.split(/\s+/)[1]) / 1024 : 0; // kB → MB
  };
  const total = parse('MemTotal');
  const free = parse('MemFree');
  const available = parse('MemAvailable');
  const used = total - available;
  return {
    data: {
      totalMB: Math.round(total),
      freeMB: Math.round(free),
      availableMB: Math.round(available),
      usedMB: Math.round(used),
      usedPct: Math.round((used / total) * 100),
    },
    error: null,
  };
}

// ── Storage ───────────────────────────────────────────────────────────────────
export async function getStorage(): Promise<{ data: string | null; error: string | null }> {
  const res = await termuxRun('df -h /storage/emulated/0 /data 2>/dev/null || df -h /');
  return { data: res.stdout || null, error: res.ok ? null : res.stderr };
}

// ── CPU / System ──────────────────────────────────────────────────────────────
export async function getCpuInfo(): Promise<{ data: string | null; error: string | null }> {
  const res = await termuxRun('cat /proc/cpuinfo | grep "Hardware\\|model name\\|processor" | head -10');
  return { data: res.stdout || null, error: res.ok ? null : res.stderr };
}

export async function getUptime(): Promise<{ data: string | null; error: string | null }> {
  const res = await termuxRun('uptime');
  return { data: res.stdout.trim() || null, error: res.ok ? null : res.stderr };
}

// ── Wi-Fi ─────────────────────────────────────────────────────────────────────
export async function getWifi(): Promise<{ data: WifiInfo | null; error: string | null }> {
  const res = await termuxAPI.wifi();
  if (!res.ok) return { data: null, error: res.stderr };
  try {
    return { data: JSON.parse(res.stdout), error: null };
  } catch {
    return { data: null, error: 'Failed to parse Wi-Fi data' };
  }
}

// ── Brightness ────────────────────────────────────────────────────────────────
export async function setBrightness(value: number): Promise<{ error: string | null }> {
  const clamped = Math.max(0, Math.min(255, Math.round((value / 100) * 255)));
  const res = await termuxAPI.brightness(clamped);
  return { error: res.ok ? null : res.stderr };
}

// ── Volume ────────────────────────────────────────────────────────────────────
export async function setVolume(value: number): Promise<{ error: string | null }> {
  const clamped = Math.max(0, Math.min(15, Math.round((value / 100) * 15)));
  const res = await termuxAPI.volume('music', clamped);
  return { error: res.ok ? null : res.stderr };
}

// ── Calls ─────────────────────────────────────────────────────────────────────
export async function makeCall(number: string): Promise<{ error: string | null }> {
  // termux-telephony-call opens the dialer — user must confirm the call
  const res = await termuxAPI.call(number);
  return { error: res.ok ? null : res.stderr };
}

// ── Contacts ──────────────────────────────────────────────────────────────────
export async function getContacts(): Promise<{ data: any[] | null; error: string | null }> {
  const res = await termuxAPI.contacts();
  if (!res.ok) return { data: null, error: res.stderr };
  try {
    return { data: JSON.parse(res.stdout), error: null };
  } catch {
    return { data: null, error: 'Failed to parse contacts' };
  }
}

// ── Full system snapshot ──────────────────────────────────────────────────────
export async function getSystemSnapshot() {
  const [battery, mem, storage, wifi, uptime] = await Promise.all([
    getBattery(),
    getMemInfo(),
    getStorage(),
    getWifi(),
    getUptime(),
  ]);
  return { battery, mem, storage, wifi, uptime };
}
