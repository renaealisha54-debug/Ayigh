#!/usr/bin/env node
/**
 * termux-relay.js  —  WebSocket relay between the web app and Termux CLI tools
 *
 * Run this INSIDE Termux, not in the web app:
 *   node ~/ayigh/termux-relay.js
 *
 * It listens on ws://localhost:8765, accepts JSON { id, command } messages,
 * runs the command as a shell process, and responds with { id, stdout, stderr, ok }.
 *
 * INSTALL DEPS (in Termux):
 *   pkg install nodejs termux-api
 *   npm install -g ws     (or: npm install ws  in this folder)
 *
 * The relay ONLY runs commands that start with allowed prefixes.
 * NEVER expose this to the internet — localhost only.
 */

const { WebSocketServer } = require('ws');
const { exec } = require('child_process');

const PORT = 8765;

// Allowlist of command prefixes that can be executed
const ALLOWED_PREFIXES = [
  'termux-',
  'cat /proc/',
  'cat /sys/',
  'df ',
  'du ',
  'ls ',
  'pwd',
  'echo ',
  'pkg ',
  'apt ',
  'git ',
  'node ',
  'npm ',
  'python',
  'bash -c',
  'sh -c',
  'cd ',
  'mkdir ',
  'cp ',
  'mv ',
  'rm ',
  'touch ',
  'grep ',
  'find ',
  'uname',
  'whoami',
  'ps ',
  'top -b',
  'free',
  'uptime',
];

function isAllowed(cmd) {
  const trimmed = cmd.trim();
  return ALLOWED_PREFIXES.some(p => trimmed.startsWith(p));
}

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
console.log(`[ayigh relay] Listening on ws://localhost:${PORT}`);

wss.on('connection', (socket) => {
  console.log('[ayigh relay] Client connected');

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    const { id, command } = msg;
    if (!id || !command) return;

    if (!isAllowed(command)) {
      socket.send(JSON.stringify({
        id, ok: false,
        stdout: '',
        stderr: `Command not in allowlist: ${command.split(' ')[0]}`
      }));
      return;
    }

    console.log(`[ayigh relay] Running: ${command}`);
    exec(command, { timeout: 12000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
      socket.send(JSON.stringify({
        id,
        ok: !err,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : ''),
      }));
    });
  });

  socket.on('close', () => console.log('[ayigh relay] Client disconnected'));
});
