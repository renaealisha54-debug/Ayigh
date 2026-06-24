'use server';

import { createClient } from '@supabase/supabase-js';

// Server-side client uses the same anon key (RLS enforces security)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface WorkspaceScript {
  id: string;
  name: string;
  content: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  created_at: string;
}

/**
 * Save a script to Supabase
 */
export async function saveScript(
  name: string,
  content: string
): Promise<{ data: WorkspaceScript | null; error: string | null }> {
  const { data, error } = await supabase
    .from('workspace_scripts')
    .insert({ name, content, status: 'PENDING' })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

/**
 * Load all scripts from Supabase
 */
export async function loadScripts(): Promise<{
  data: WorkspaceScript[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('workspace_scripts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

/**
 * Update a script's execution status
 */
export async function updateScriptStatus(
  id: string,
  status: 'SUCCESS' | 'FAILED'
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workspace_scripts')
    .update({ status })
    .eq('id', id);

  return { error: error?.message ?? null };
}

/**
 * Delete a script by id
 */
export async function deleteScript(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('workspace_scripts')
    .delete()
    .eq('id', id);

  return { error: error?.message ?? null };
}
