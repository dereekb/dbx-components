import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';

import { findProject } from './project-lookup';
import { cacheFileName, type LintCache, type LintCacheFileSummary, type LintCacheMessage, type LintCacheRuleSummary } from './types';

export interface BuildOptions {
  readonly project: string;
  readonly workspaceRoot: string;
  readonly outputDir: string;
  readonly nxArgs: readonly string[] | undefined;
  readonly fix: boolean;
}

export interface BuildResult {
  readonly cachePath: string;
  readonly cache: LintCache;
}

interface EslintRawMessage {
  readonly ruleId: string | null;
  readonly severity: 0 | 1 | 2;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly fix?: unknown;
}

interface EslintRawResult {
  readonly filePath: string;
  readonly messages: readonly EslintRawMessage[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly fixableErrorCount: number;
  readonly fixableWarningCount: number;
}

/**
 * Lints a single Nx project by spawning `nx run <project>:lint --format=json`
 * and parsing the resulting ESLint JSON, then writes a grouped JSON cache
 * containing every message, per-rule summaries, and per-file summaries.
 *
 * Subsequent `query` invocations read this cache without re-running ESLint.
 * Using Nx's executor (rather than the ESLint Node API directly) keeps the
 * call compatible with workspace-specific flat-config compatibility shims
 * that the executor applies internally.
 */
export async function runBuild(opts: BuildOptions): Promise<BuildResult> {
  const project = findProject(opts.workspaceRoot, opts.project);
  if (!project) {
    throw new Error(`project not found in workspace: ${opts.project}`);
  }

  if (!existsSync(opts.outputDir)) mkdirSync(opts.outputDir, { recursive: true });
  const tmpFile = join(opts.outputDir, `.tmp-${randomUUID()}.json`);
  const tmpFileRel = relative(opts.workspaceRoot, tmpFile);

  let raw: readonly EslintRawResult[];
  try {
    await spawnNxLint({
      workspaceRoot: opts.workspaceRoot,
      project: opts.project,
      outputFile: tmpFileRel,
      fix: opts.fix,
      extraArgs: opts.nxArgs ?? []
    });
    if (!existsSync(tmpFile)) {
      throw new Error(`nx lint did not write the expected JSON output to ${tmpFile}`);
    }
    raw = JSON.parse(readFileSync(tmpFile, 'utf8')) as readonly EslintRawResult[];
  } finally {
    if (existsSync(tmpFile)) rmSync(tmpFile, { force: true });
  }

  const cache = buildCache({
    raw,
    project: opts.project,
    projectRoot: project.projectRoot,
    workspaceRoot: opts.workspaceRoot
  });

  const cachePath = join(opts.outputDir, cacheFileName(opts.project));
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  return { cachePath, cache };
}

interface SpawnNxLintOptions {
  readonly workspaceRoot: string;
  readonly project: string;
  readonly outputFile: string;
  readonly fix: boolean;
  readonly extraArgs: readonly string[];
}

function spawnNxLint(opts: SpawnNxLintOptions): Promise<void> {
  const fixArgs = opts.fix ? ['--fix'] : [];
  const args = ['nx', 'run', `${opts.project}:lint`, '--format=json', `--output-file=${opts.outputFile}`, '--silent', '--no-cloud', ...fixArgs, ...opts.extraArgs];
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npx', args, {
      cwd: opts.workspaceRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'inherit', 'inherit']
    });
    child.on('error', rejectPromise);
    child.on('exit', () => {
      // Non-zero exit from nx lint (errors found) is expected; the JSON file is still written.
      resolvePromise();
    });
  });
}

interface BuildCacheInput {
  readonly raw: readonly EslintRawResult[];
  readonly project: string;
  readonly projectRoot: string;
  readonly workspaceRoot: string;
}

function buildCache(input: BuildCacheInput): LintCache {
  const messages: LintCacheMessage[] = [];
  const fileSummariesMap = new Map<string, { errors: number; warnings: number }>();
  const ruleSummariesMap = new Map<string, { errors: number; warnings: number; files: Set<string> }>();

  let errorCount = 0;
  let warningCount = 0;
  let fixableErrorCount = 0;
  let fixableWarningCount = 0;
  let filesWithIssues = 0;

  for (const r of input.raw) {
    if (r.messages.length === 0) continue;
    const filePath = relative(input.workspaceRoot, r.filePath) || r.filePath;
    filesWithIssues += 1;
    fileSummariesMap.set(filePath, { errors: r.errorCount, warnings: r.warningCount });
    errorCount += r.errorCount;
    warningCount += r.warningCount;
    fixableErrorCount += r.fixableErrorCount;
    fixableWarningCount += r.fixableWarningCount;

    for (const m of r.messages) {
      const sev: 'error' | 'warning' = m.severity === 2 ? 'error' : 'warning';
      messages.push({
        filePath,
        line: m.line ?? 0,
        column: m.column ?? 0,
        endLine: m.endLine ?? null,
        endColumn: m.endColumn ?? null,
        ruleId: m.ruleId ?? null,
        severity: sev,
        message: m.message,
        fixable: m.fix != null
      });
      const ruleKey = m.ruleId ?? '(no-rule)';
      let entry = ruleSummariesMap.get(ruleKey);
      if (!entry) {
        entry = { errors: 0, warnings: 0, files: new Set<string>() };
        ruleSummariesMap.set(ruleKey, entry);
      }
      if (sev === 'error') entry.errors += 1;
      else entry.warnings += 1;
      entry.files.add(filePath);
    }
  }

  const ruleSummaries: LintCacheRuleSummary[] = Array.from(ruleSummariesMap.entries())
    .map(([rule, v]) => ({ rule, errors: v.errors, warnings: v.warnings, files: v.files.size }))
    .sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings) || a.rule.localeCompare(b.rule));

  const fileSummaries: LintCacheFileSummary[] = Array.from(fileSummariesMap.entries())
    .map(([filePath, v]) => ({ filePath, errors: v.errors, warnings: v.warnings }))
    .sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings) || a.filePath.localeCompare(b.filePath));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: input.project,
    projectRoot: input.projectRoot,
    eslintVersion: 'nx-lint-executor',
    errorCount,
    warningCount,
    fixableErrorCount,
    fixableWarningCount,
    fileCount: input.raw.length,
    filesWithIssues,
    ruleSummaries,
    fileSummaries,
    messages
  };
}
