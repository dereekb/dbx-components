/**
 * Filesystem discovery for the `dbx_log_search` tool. Resolves the log root
 * from caller args (or the `DBX_LOG_PATH` env var), enumerates project
 * subdirectories, and filters `.md` entries by modification time.
 */

import { readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { LogFileRef } from './types.js';

/**
 * Environment variable consulted when `basePath` is not passed on the tool args.
 */
export const DBX_LOG_PATH_ENV_VAR = 'DBX_LOG_PATH';

/**
 * Input for {@link resolveLogBasePath}.
 */
export interface ResolveLogBasePathInput {
  readonly basePath: string | undefined;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Result of {@link resolveLogBasePath}. Returns the absolute path on success;
 * otherwise an `error` describing why no path was available.
 */
export type ResolveLogBasePathResult = { readonly kind: 'ok'; readonly absolutePath: string; readonly source: 'arg' | 'env' } | { readonly kind: 'error'; readonly message: string };

/**
 * Resolves the absolute log-root path from the caller args or env. Does not
 * touch the filesystem — callers verify existence separately so they can
 * differentiate "unset" from "set but missing".
 */
export function resolveLogBasePath(input: ResolveLogBasePathInput): ResolveLogBasePathResult {
  let result: ResolveLogBasePathResult;
  const fromArg = input.basePath?.trim();
  if (fromArg !== undefined && fromArg.length > 0) {
    result = { kind: 'ok', absolutePath: resolve(fromArg), source: 'arg' };
  } else {
    const fromEnv = input.env[DBX_LOG_PATH_ENV_VAR]?.trim();
    if (fromEnv !== undefined && fromEnv.length > 0) {
      result = { kind: 'ok', absolutePath: resolve(fromEnv), source: 'env' };
    } else {
      result = { kind: 'error', message: `No log path configured. Set ${DBX_LOG_PATH_ENV_VAR} or pass basePath.` };
    }
  }
  return result;
}

/**
 * Input for {@link discoverLogs}.
 */
export interface DiscoverLogsInput {
  readonly basePath: string;
  /**
   * Project subdirectory name to scan, or the literal string `'all'` to scan
   * every immediate child directory.
   */
  readonly project: string;
  /**
   * When `true` and the primary project yields zero hits, scan every sibling
   * directory as well. Ignored when `project === 'all'`.
   */
  readonly includeSiblings: boolean;
  /**
   * Absolute lower-bound mtime (epoch ms). Files with `mtimeMs < since` are
   * dropped.
   */
  readonly since: number;
}

/**
 * Result of {@link discoverLogs}. `missingBase` flags a non-existent log root
 * so callers can surface a clean message instead of a stack trace.
 */
export interface DiscoverLogsResult {
  readonly logs: readonly LogFileRef[];
  readonly scannedProjects: readonly string[];
  readonly missingBase: boolean;
  readonly missingProject: boolean;
  readonly fellBackToSiblings: boolean;
}

/**
 * Walks the log root and returns every `.md` file matching the project scope
 * and the time window. Follows symlinks via the default `stat` (the user's
 * production log dir is itself a symlink target).
 */
export async function discoverLogs(input: DiscoverLogsInput): Promise<DiscoverLogsResult> {
  const baseExists = await pathIsDir(input.basePath);
  let result: DiscoverLogsResult;
  if (!baseExists) {
    result = { logs: [], scannedProjects: [], missingBase: true, missingProject: false, fellBackToSiblings: false };
  } else if (input.project === 'all') {
    const projects = await listChildDirs(input.basePath);
    const logs = await collectFromProjects({ basePath: input.basePath, projects, since: input.since });
    result = { logs, scannedProjects: projects, missingBase: false, missingProject: false, fellBackToSiblings: false };
  } else {
    const primaryAbs = join(input.basePath, input.project);
    const primaryExists = await pathIsDir(primaryAbs);
    if (!primaryExists) {
      if (input.includeSiblings) {
        const siblings = await listChildDirs(input.basePath);
        const logs = await collectFromProjects({ basePath: input.basePath, projects: siblings, since: input.since });
        result = { logs, scannedProjects: siblings, missingBase: false, missingProject: true, fellBackToSiblings: true };
      } else {
        result = { logs: [], scannedProjects: [], missingBase: false, missingProject: true, fellBackToSiblings: false };
      }
    } else {
      const primaryLogs = await collectFromProjects({ basePath: input.basePath, projects: [input.project], since: input.since });
      if (primaryLogs.length === 0 && input.includeSiblings) {
        const siblings = (await listChildDirs(input.basePath)).filter((p) => p !== input.project);
        const siblingLogs = await collectFromProjects({ basePath: input.basePath, projects: siblings, since: input.since });
        result = { logs: siblingLogs, scannedProjects: [input.project, ...siblings], missingBase: false, missingProject: false, fellBackToSiblings: true };
      } else {
        result = { logs: primaryLogs, scannedProjects: [input.project], missingBase: false, missingProject: false, fellBackToSiblings: false };
      }
    }
  }
  return result;
}

async function pathIsDir(absPath: string): Promise<boolean> {
  let isDir = false;
  try {
    const info = await stat(absPath);
    isDir = info.isDirectory();
  } catch {
    isDir = false;
  }
  return isDir;
}

async function listChildDirs(absPath: string): Promise<readonly string[]> {
  let dirs: readonly string[] = [];
  try {
    const entries = await readdir(absPath, { withFileTypes: true });
    dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    dirs = [];
  }
  return dirs;
}

interface CollectFromProjectsInput {
  readonly basePath: string;
  readonly projects: readonly string[];
  readonly since: number;
}

async function collectFromProjects(input: CollectFromProjectsInput): Promise<readonly LogFileRef[]> {
  const collected: LogFileRef[] = [];
  for (const project of input.projects) {
    const projectDir = join(input.basePath, project);
    let entries: { name: string; isFile: boolean }[] = [];
    try {
      const dirents = await readdir(projectDir, { withFileTypes: true });
      entries = dirents.map((d) => ({ name: d.name, isFile: d.isFile() || d.isSymbolicLink() }));
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (entry.isFile && entry.name.endsWith('.md')) {
        const absolutePath = join(projectDir, entry.name);
        let info: Awaited<ReturnType<typeof stat>> | undefined;
        try {
          info = await stat(absolutePath);
        } catch {
          info = undefined;
        }
        if (info !== undefined && info.isFile() && info.mtimeMs >= input.since) {
          const ref: LogFileRef = {
            absolutePath,
            relativePath: join(project, entry.name),
            project,
            fileName: basename(entry.name),
            mtimeMs: info.mtimeMs,
            sizeBytes: info.size
          };
          collected.push(ref);
        }
      }
    }
  }
  collected.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return collected;
}
