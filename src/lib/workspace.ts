/**
 * Workspace — local storage only, no backend needed
 */

export interface WorkspaceScript {
  id: string;
  name: string;
  content: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  created_at: string;
}

const KEY = 'ayigh_scripts';

function load(): WorkspaceScript[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch { return []; }
}

function save(scripts: WorkspaceScript[]) {
  localStorage.setItem(KEY, JSON.stringify(scripts));
}

export async function saveScript(name: string, content: string): Promise<{ data: WorkspaceScript | null; error: string | null }> {
  const scripts = load();
  const entry: WorkspaceScript = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name, content, status: 'PENDING',
    created_at: new Date().toISOString(),
  };
  scripts.unshift(entry);
  save(scripts);
  return { data: entry, error: null };
}

export async function loadScripts(): Promise<{ data: WorkspaceScript[]; error: string | null }> {
  return { data: load(), error: null };
}

export async function updateScriptStatus(id: string, status: 'SUCCESS' | 'FAILED'): Promise<{ error: string | null }> {
  const scripts = load().map(s => s.id === id ? { ...s, status } : s);
  save(scripts);
  return { error: null };
}

export async function deleteScript(id: string): Promise<{ error: string | null }> {
  save(load().filter(s => s.id !== id));
  return { error: null };
}

export async function saveScriptWithContent(name: string, content: string): Promise<{ data: WorkspaceScript | null; error: string | null }> {
  return saveScript(name, content);
}
