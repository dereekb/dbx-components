/**
 * App-port discovery for the route cluster.
 *
 * Scans `apps/<name>/project.json` files under a working directory and builds
 * a `{ port → app, name → app }` map by reading the Nx `targets.serve`
 * `options.port` plus every `configurations.*.port`. The map is keyed by both
 * directions so `dbx_route_resolve_url` can go from a dev-server port (or an
 * explicit `app` override) back to the project root.
 *
 * Result is cached per resolved cwd for the process lifetime — `project.json`
 * files don't change between MCP calls in a running session.
 */

import { glob as fsGlob, readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export interface AppEntry {
  readonly name: string;
  readonly projectRoot: string;
  readonly ports: readonly number[];
}

export interface AppPortMap {
  readonly cwd: string;
  readonly byPort: ReadonlyMap<number, AppEntry>;
  readonly byName: ReadonlyMap<string, AppEntry>;
  readonly entries: readonly AppEntry[];
}

const CACHE = new Map<string, Promise<AppPortMap>>();

/**
 * Returns a cached `AppPortMap` for the resolved cwd, scanning `apps/*\/project.json`
 * the first time it is requested. Each scan walks the workspace tree off-disk
 * once — subsequent calls reuse the cached promise.
 *
 * @param cwd - The working directory whose `apps/` tree to scan. Resolved
 *   against `process.cwd()` so callers may pass relative overrides.
 * @returns A populated map keyed by port and project name.
 */
export async function loadAppPortMap(cwd: string | undefined): Promise<AppPortMap> {
  const resolved = cwd ? resolve(process.cwd(), cwd) : process.cwd();
  let pending = CACHE.get(resolved);
  if (!pending) {
    pending = scanAppPortMap(resolved);
    CACHE.set(resolved, pending);
  }
  return pending;
}

async function scanAppPortMap(cwdResolved: string): Promise<AppPortMap> {
  const entries: AppEntry[] = [];
  for await (const match of fsGlob('apps/*/project.json', { cwd: cwdResolved })) {
    const projectRoot = dirname(match);
    const absolute = resolve(cwdResolved, match);
    const entry = await readEntry({ projectJsonAbsolute: absolute, projectRoot });
    if (entry) {
      entries.push(entry);
    }
  }
  const byPort = new Map<number, AppEntry>();
  const byName = new Map<string, AppEntry>();
  for (const entry of entries) {
    byName.set(entry.name, entry);
    for (const port of entry.ports) {
      if (!byPort.has(port)) {
        byPort.set(port, entry);
      }
    }
  }
  const result: AppPortMap = {
    cwd: cwdResolved,
    byPort,
    byName,
    entries
  };
  return result;
}

interface ReadEntryInput {
  readonly projectJsonAbsolute: string;
  readonly projectRoot: string;
}

async function readEntry(input: ReadEntryInput): Promise<AppEntry | undefined> {
  let parsed: unknown;
  let readError = false;
  try {
    const text = await readFile(input.projectJsonAbsolute, 'utf8');
    parsed = JSON.parse(text);
  } catch {
    readError = true;
  }
  let result: AppEntry | undefined;
  if (!readError && isRecord(parsed)) {
    const name = typeof parsed.name === 'string' ? parsed.name : (input.projectRoot.split(sep).pop() ?? input.projectRoot);
    const ports = collectPorts(parsed);
    result = {
      name,
      projectRoot: input.projectRoot,
      ports
    };
  }
  return result;
}

function collectPorts(projectJson: Record<string, unknown>): readonly number[] {
  const targets = isRecord(projectJson.targets) ? projectJson.targets : undefined;
  const serve = targets && isRecord(targets.serve) ? targets.serve : undefined;
  const out = new Set<number>();
  if (!serve) {
    return [];
  }
  const options = isRecord(serve.options) ? serve.options : undefined;
  if (options && typeof options.port === 'number') {
    out.add(options.port);
  }
  const configurations = isRecord(serve.configurations) ? serve.configurations : undefined;
  if (configurations) {
    for (const value of Object.values(configurations)) {
      if (isRecord(value) && typeof value.port === 'number') {
        out.add(value.port);
      }
    }
  }
  return Array.from(out);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Test-only: clears the internal cache so each spec sees a fresh scan.
 */
export function resetAppPortMapCache(): void {
  CACHE.clear();
}
