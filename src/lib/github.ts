/**
 * GitHub integration via Termux git
 * All git operations run through the Termux relay as shell commands.
 */

import { termuxRun } from './termux';

export interface RepoStatus {
  branch: string;
  status: string;
  log: string;
}

export async function gitStatus(repoPath: string): Promise<{ data: RepoStatus | null; error: string | null }> {
  const branch = await termuxRun(`git -C ${repoPath} rev-parse --abbrev-ref HEAD 2>&1`);
  const status = await termuxRun(`git -C ${repoPath} status --short 2>&1`);
  const log = await termuxRun(`git -C ${repoPath} log --oneline -5 2>&1`);
  if (!branch.ok) return { data: null, error: branch.stderr };
  return {
    data: {
      branch: branch.stdout.trim(),
      status: status.stdout.trim() || 'clean',
      log: log.stdout.trim(),
    },
    error: null,
  };
}

export async function gitCommitPush(
  repoPath: string,
  message: string
): Promise<{ output: string; error: string | null }> {
  const add = await termuxRun(`git -C ${repoPath} add -A 2>&1`);
  const commit = await termuxRun(`git -C ${repoPath} commit -m "${message.replace(/"/g, "'")}" 2>&1`);
  const push = await termuxRun(`git -C ${repoPath} push 2>&1`);
  const output = [add.stdout, commit.stdout, push.stdout].filter(Boolean).join('\n');
  const error = [add.stderr, commit.stderr, push.stderr].filter(s => s && !s.includes('nothing')).join('\n');
  return { output, error: error || null };
}

export async function gitPull(repoPath: string): Promise<{ output: string; error: string | null }> {
  const res = await termuxRun(`git -C ${repoPath} pull 2>&1`);
  return { output: res.stdout, error: res.ok ? null : res.stderr };
}

export async function listRepos(): Promise<{ data: string[] | null; error: string | null }> {
  const res = await termuxRun('find ~ -maxdepth 3 -name ".git" -type d 2>/dev/null');
  if (!res.ok) return { data: null, error: res.stderr };
  const repos = res.stdout
    .split('\n')
    .filter(Boolean)
    .map(p => p.replace('/.git', ''));
  return { data: repos, error: null };
}
