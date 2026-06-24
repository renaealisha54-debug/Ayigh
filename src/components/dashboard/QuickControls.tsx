"use client"

import React, { useState } from 'react';
import { 
  Sun, Moon, Volume2, Wifi, Bluetooth, Zap,
  PhoneCall, Smartphone, Share2, Flashlight, 
  Loader2
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { setBrightness, setVolume } from '@/lib/phone';
import { termuxAPI } from '@/lib/termux';
import { toast } from '@/hooks/use-toast';

export function QuickControls() {
  const [brightness, setBrightnessState] = useState([70]);
  const [volume, setVolumeState] = useState([45]);
  const [wifi, setWifi] = useState(true);
  const [torch, setTorch] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const applyBrightness = async (val: number[]) => {
    setBrightnessState(val);
    setApplying('brightness');
    const res = await setBrightness(val[0]);
    if (res.error) toast({ title: 'Brightness', description: res.error, variant: 'destructive' });
    setApplying(null);
  };

  const applyVolume = async (val: number[]) => {
    setVolumeState(val);
    setApplying('volume');
    const res = await setVolume(val[0]);
    if (res.error) toast({ title: 'Volume', description: res.error, variant: 'destructive' });
    setApplying(null);
  };

  const toggleWifi = async (on: boolean) => {
    setWifi(on);
    setApplying('wifi');
    const res = await termuxAPI.wifiEnable(on);
    if (!res.ok) toast({ title: 'Wi-Fi', description: res.stderr, variant: 'destructive' });
    setApplying(null);
  };

  const toggleTorch = async (on: boolean) => {
    setTorch(on);
    setApplying('torch');
    const res = await termuxAPI.torch(on);
    if (!res.ok) toast({ title: 'Torch', description: res.stderr, variant: 'destructive' });
    setApplying(null);
  };

  return (
    <div className="space-y-4 p-3">
      {/* Sliders */}
      <div className="space-y-4 p-4 bg-secondary/20 rounded-lg border border-border/50">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Brightness</span>
            </div>
            <span className="text-[10px] text-primary font-black flex items-center gap-1">
              {applying === 'brightness' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {brightness[0]}%
            </span>
          </div>
          <Slider
            value={brightness}
            onValueChange={setBrightnessState}
            onValueCommit={applyBrightness}
            max={100} step={5}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Volume</span>
            </div>
            <span className="text-[10px] text-accent font-black flex items-center gap-1">
              {applying === 'volume' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
              {volume[0]}%
            </span>
          </div>
          <Slider
            value={volume}
            onValueChange={setVolumeState}
            onValueCommit={applyVolume}
            max={100} step={5}
            className="w-full"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: 'Wi-Fi',
            icon: Wifi,
            color: 'text-primary',
            value: wifi,
            onChange: toggleWifi,
            key: 'wifi',
          },
          {
            label: 'Torch',
            icon: Zap,
            color: 'text-yellow-400',
            value: torch,
            onChange: toggleTorch,
            key: 'torch',
          },
          {
            label: 'Night',
            icon: Moon,
            color: 'text-purple-400',
            value: false,
            onChange: async (on: boolean) => {
              toast({ title: 'Night Mode', description: 'Use voice: "enable night mode"' });
            },
            key: 'night',
          },
          {
            label: 'Cloud',
            icon: Zap,
            color: 'text-green-400',
            value: false,
            onChange: async () => {},
            key: 'cloud',
          },
        ].map(item => (
          <div key={item.label} className="p-3 bg-secondary/20 border border-border/50 rounded-lg flex flex-col justify-between hud-border">
            <div className="flex items-center justify-between">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              {applying === item.key && <Loader2 className="w-2.5 h-2.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] font-bold uppercase">{item.label}</span>
              <Switch
                checked={item.value}
                onCheckedChange={item.onChange}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmergencyHub() {
  const contacts = [
    { name: 'Open Termux', role: 'Terminal', icon: Smartphone, action: () => { window.location.href = 'termux://open'; } },
    { name: 'Operations', role: 'Security', icon: PhoneCall, action: () => { window.location.href = 'tel:'; } },
    { name: 'Admin Hub', role: 'Business', icon: Share2, action: () => {} },
  ];

  return (
    <div className="p-3 space-y-3">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">
        Rapid Access
      </h3>
      <div className="space-y-2">
        {contacts.map(c => (
          <Button
            key={c.name}
            variant="outline"
            className="w-full justify-between h-12 bg-secondary/20 border-primary/20 hover:bg-primary/10 hover:border-primary/40 group text-left"
            onClick={c.action}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded group-hover:bg-primary/20 transition-colors">
                <c.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase">{c.name}</div>
                <div className="text-[9px] text-muted-foreground uppercase">{c.role}</div>
              </div>
            </div>
            <PhoneCall className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all text-primary" />
          </Button>
        ))}
      </div>
    </div>
  );
}
