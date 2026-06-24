"use client"

import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Activity, Globe, Battery, Wifi, Signal } from 'lucide-react';
import { getBattery, getWifi } from '@/lib/phone';

export function HUDHeader() {
  const [time, setTime] = useState(new Date());
  const [battery, setBattery] = useState<number | null>(null);
  const [wifiSsid, setWifiSsid] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      const [bat, wifi] = await Promise.all([getBattery(), getWifi()]);
      if (bat.data) setBattery(bat.data.percentage);
      if (wifi.data) setWifiSsid(wifi.data.ssid);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const batColor =
    battery === null ? 'text-muted-foreground'
    : battery <= 20 ? 'text-red-400'
    : battery <= 50 ? 'text-yellow-400'
    : 'text-green-400';

  return (
    <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 bg-background/50 border-b border-primary/20 backdrop-blur-md shrink-0">
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-primary rounded-lg rotate-45 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary -rotate-45" />
          </div>
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-headline font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
            V ayigh
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <div className="flex items-center gap-1 text-[9px] text-primary uppercase font-bold tracking-widest">
              <ShieldCheck className="w-2.5 h-2.5" />
              SECURE
            </div>
            {wifiSsid && (
              <div className="flex items-center gap-1 text-[9px] text-accent uppercase font-bold tracking-widest">
                <Wifi className="w-2.5 h-2.5" />
                {wifiSsid}
              </div>
            )}
            {battery !== null && (
              <div className={`flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase ${batColor}`}>
                <Battery className="w-2.5 h-2.5" />
                {battery}%
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 mt-4 md:mt-0">
        <div className="text-right">
          <div className="text-xl font-code font-bold tracking-widest text-foreground">
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase font-bold">
            {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );
}
