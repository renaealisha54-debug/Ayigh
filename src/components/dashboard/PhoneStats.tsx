"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { Battery, Cpu, HardDrive, Wifi, RefreshCw, Thermometer, MemoryStick } from 'lucide-react';
import { getBattery, getMemInfo, getStorage, getWifi, getUptime } from '@/lib/phone';
import type { BatteryStatus, MemInfo, WifiInfo } from '@/lib/phone';
import { cn } from '@/lib/utils';

interface Stats {
  battery: BatteryStatus | null;
  mem: MemInfo | null;
  storage: string | null;
  wifi: WifiInfo | null;
  uptime: string | null;
}

function StatBar({ value, color = 'primary' }: { value: number; color?: string }) {
  return (
    <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          value > 85 ? 'bg-red-500' : value > 60 ? 'bg-yellow-500' : `bg-${color}`
        }`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function PhoneStats() {
  const [stats, setStats] = useState<Stats>({ battery: null, mem: null, storage: null, wifi: null, uptime: null });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [bat, mem, stor, wifi, up] = await Promise.all([
      getBattery(),
      getMemInfo(),
      getStorage(),
      getWifi(),
      getUptime(),
    ]);
    setStats({
      battery: bat.data,
      mem: mem.data,
      storage: stor.data,
      wifi: wifi.data,
      uptime: up.data,
    });
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const batColor = stats.battery
    ? stats.battery.percentage <= 20 ? 'text-red-400'
    : stats.battery.percentage <= 50 ? 'text-yellow-400'
    : 'text-green-400'
    : 'text-muted-foreground';

  return (
    <div className="bg-secondary/10 border border-border/50 rounded-xl hud-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-[0.15em]">Device Stats</span>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 rounded hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3 h-3 text-muted-foreground", loading && "animate-spin")} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Battery */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Battery className={cn("w-3.5 h-3.5", batColor)} />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Battery</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {stats.battery ? (
                <>
                  <span className={cn("font-black", batColor)}>{stats.battery.percentage}%</span>
                  <span className="text-muted-foreground">{stats.battery.status}</span>
                  {stats.battery.temperature && (
                    <span className="text-muted-foreground">{(stats.battery.temperature / 10).toFixed(1)}°C</span>
                  )}
                </>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
          </div>
          {stats.battery && <StatBar value={stats.battery.percentage} color="green-500" />}
        </div>

        {/* Memory */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <MemoryStick className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Memory</span>
            </div>
            <div className="text-[10px]">
              {stats.mem ? (
                <span className="text-accent font-black">
                  {stats.mem.usedMB}MB / {stats.mem.totalMB}MB
                  <span className="text-muted-foreground ml-1">({stats.mem.usedPct}%)</span>
                </span>
              ) : <span className="text-muted-foreground">—</span>}
            </div>
          </div>
          {stats.mem && <StatBar value={stats.mem.usedPct} color="accent" />}
        </div>

        {/* Wi-Fi */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Wi-Fi</span>
          </div>
          <div className="text-[10px] text-right">
            {stats.wifi ? (
              <span className="text-primary font-black">
                {stats.wifi.ssid || 'Connected'}
                {stats.wifi.ip && <span className="text-muted-foreground ml-1">{stats.wifi.ip}</span>}
              </span>
            ) : <span className="text-muted-foreground">Not connected</span>}
          </div>
        </div>

        {/* Storage raw */}
        {stats.storage && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Storage</span>
            </div>
            <pre className="text-[9px] font-code text-muted-foreground leading-4 overflow-x-auto">
              {stats.storage.trim()}
            </pre>
          </div>
        )}

        {/* Uptime */}
        {stats.uptime && (
          <div className="text-[9px] text-muted-foreground/60 font-code">{stats.uptime}</div>
        )}

        {lastUpdated && (
          <div className="text-[9px] text-muted-foreground/40 text-right">
            Updated {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
          </div>
        )}
      </div>
    </div>
  );
}
