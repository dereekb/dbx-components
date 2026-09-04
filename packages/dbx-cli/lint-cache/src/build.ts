import { spawn } from 'node:child_process';
import type { Maybe } from '@dereekb/util';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';

import { patchIndexEntry, projectResultFromCache } from './build-many';
import { parseOxlintResult } from './oxlint-result';
import { findProject } from './project-lookup';
import { cacheFileName, DEFAULT_LINT_CACHE_LINTER, LINT_CACHE_LINTER_TARGET_NAMES, type LintCache, type LintCacheFileSummary, type LintCacheLinter, type LintCacheMessage, type LintCacheRuleSummary } from './types';

export interface BuildOptions {
  readonly project: string;
  readonly workspaceRoot: string;
  readonly outputDir: string;
  readonly nxArgs: Maybe<readonly string[]>;
  readonly fix: boolean;
  /**
   * Which engine to run. Defaults to `eslint`.
   */
  readonly linter?: LintCacheLinter;
  /**
   * When true (default), if `<outputDir>/index.json` exists the matching
   * project entry is patched after the per-project cache is written so the
   * aggregate stays consistent with single-project rebuilds. `runBuildMany`
   * passes `false` because it writes the full index in one shot at the end,
   * which avoids concurrent reader/writer races when multiple workers run.
   */
  readonly updateIndex?: boolean;
}

export interface BuildResult {
  readonly cachePath: string;
  readonly cache: LintCache;
}

interface EslintRawMessage {
  readonly ruleId: Maybe<string>;
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
 * A linter-agnostic finding. Both the ESLint formatter output and oxlint's
 * `--format=json` diagnostics are converted to this before any counting happens,
 * so `buildCache` has exactly one code path and the two tiers cannot drift in how
 * they summarize.
 */
interface NormalizedMessage {
  readonly ruleId: Maybe<string>;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly line: number;
  readonly column: number;
  readonly endLine: Maybe<number>;
  readonly endColumn: Maybe<number>;
  readonly fixable: boolean;
}

interface NormalizedFile {
  /**
   * Absolute path; relativized against the workspace root by `buildCache`.
   */
  readonly filePath: string;
  readonly messages: readonly NormalizedMessage[];
}

interface NormalizedResult {
  readonly files: readonly NormalizedFile[];
  readonly fileCount: number;
}

/**
 * Lints a single Nx project through its linter's Nx target and writes a grouped
 * JSON cache containing every message, per-rule summaries, and per-file summaries.
 *
 * Subsequent `query` invocations read this cache without re-running the linter.
 * Using Nx's target (rather than the ESLint/oxlint APIs directly) keeps the call
 * compatible with the workspace-specific flat-config compatibility shims the
 * ESLint executor applies internally, and with the per-project `--ignore-pattern`
 * set that `@nx/oxlint` computes for nested project roots.
 *
 * The two engines differ in how a machine-readable result is obtained: the ESLint
 * executor writes it to `--output-file`, while oxlint has no such flag and must be
 * scraped from stdout alongside Nx's own banner. That difference is confined to
 * {@link spawnLintTarget} and the two adapters below.
 *
 * @param opts - The project to lint, the workspace root, the cache output directory, the linter, and any extra nx args / --fix flag.
 * @returns The written cache path and the in-memory cache object.
 */
export async function runBuild(opts: BuildOptions): Promise<BuildResult> {
  const linter = opts.linter ?? DEFAULT_LINT_CACHE_LINTER;
  const targetName = LINT_CACHE_LINTER_TARGET_NAMES[linter];
  const project = findProject(opts.workspaceRoot, opts.project, targetName);
  if (!project) {
    throw new Error(`project not found in workspace: ${opts.project}`);
  }

  if (!existsSync(opts.outputDir)) mkdirSync(opts.outputDir, { recursive: true });
  const tmpFile = join(opts.outputDir, `.tmp-${randomUUID()}.json`);
  const tmpFileRel = relative(opts.workspaceRoot, tmpFile);

  let normalized: NormalizedResult;
  try {
    const stdout = await spawnLintTarget({
      workspaceRoot: opts.workspaceRoot,
      project: opts.project,
      targetName,
      outputFile: linter === 'eslint' ? tmpFileRel : null,
      silent: linter === 'eslint',
      fix: opts.fix,
      extraArgs: opts.nxArgs ?? []
    });

    if (linter === 'eslint') {
      if (!existsSync(tmpFile)) {
        throw new Error(`nx run ${opts.project}:${targetName} did not write the expected JSON output to ${tmpFile}`);
      }
      normalized = normalizeEslintResult(JSON.parse(readFileSync(tmpFile, 'utf8')) as readonly EslintRawResult[]);
    } else {
      normalized = parseOxlintResult({ stdout, cwd: project.absoluteRoot });
    }
  } finally {
    if (existsSync(tmpFile)) rmSync(tmpFile, { force: true });
  }

  const cache = buildCache({
    normalized,
    linter,
    targetName,
    project: opts.project,
    projectRoot: project.projectRoot,
    workspaceRoot: opts.workspaceRoot
  });

  const cachePath = join(opts.outputDir, cacheFileName(opts.project, linter));
  writeFileSync(cachePath, JSON.stringify(cache, null, 2));

  if (opts.updateIndex !== false) {
    patchIndexEntry({
      outputDir: opts.outputDir,
      linter,
      entry: projectResultFromCache({ project: opts.project, cachePath, cache })
    });
  }

  return { cachePath, cache };
}

/**
 * Converts the ESLint JSON formatter's per-file results into {@link NormalizedResult}.
 *
 * @param raw - The parsed contents of the ESLint `--output-file` JSON.
 * @returns The findings in linter-agnostic form, with every scanned file counted.
 */
function normalizeEslintResult(raw: readonly EslintRawResult[]): NormalizedResult {
  const files = raw.map((r) => ({
    filePath: r.filePath,
    messages: r.messages.map((m) => ({
      ruleId: m.ruleId ?? null,
      severity: (m.severity === 2 ? 'error' : 'warning') as 'error' | 'warning',
      message: m.message,
      line: m.line ?? 0,
      column: m.column ?? 0,
      endLine: m.endLine ?? null,
      endColumn: m.endColumn ?? null,
      fixable: m.fix != null
    }))
  }));
  return { files, fileCount: raw.length };
}

interface SpawnLintTargetOptions {
  readonly workspaceRoot: string;
  readonly project: string;
  readonly targetName: string;
  /**
   * Workspace-relative path passed as `--output-file`, or `null` for a linter that has no such flag.
   */
  readonly outputFile: Maybe<string>;
  /**
   * Whether to pass `--silent`.
   *
   * MUST stay false for oxlint. Nx forwards unrecognized flags straight through to
   * the underlying command, and oxlint's own `--silent` suppresses the diagnostics
   * *inside* its JSON while still reporting the scanned-file count — so the run
   * looks like a healthy zero-finding pass rather than a broken one. ESLint is
   * unaffected because its result goes to `--output-file` rather than stdout.
   */
  readonly silent: boolean;
  readonly fix: boolean;
  readonly extraArgs: readonly string[];
}

/**
 * Runs `nx run <project>:<target> --format=json …` and captures stdout.
 *
 * stdout is captured rather than inherited because oxlint has no `--output-file`
 * flag — its JSON *is* stdout. stderr stays inherited so a genuine target failure
 * is still visible to the caller.
 *
 * @param opts - The project/target to run, the optional `--output-file` path, the silent/fix flags, and any extra nx args.
 * @returns Everything the target wrote to stdout.
 */
function spawnLintTarget(opts: SpawnLintTargetOptions): Promise<string> {
  const fixArgs = opts.fix ? ['--fix'] : [];
  const outputFileArgs = opts.outputFile ? [`--output-file=${opts.outputFile}`] : [];
  const silentArgs = opts.silent ? ['--silent'] : [];
  const args = ['nx', 'run', `${opts.project}:${opts.targetName}`, '--format=json', ...outputFileArgs, ...silentArgs, '--no-cloud', ...fixArgs, ...opts.extraArgs];
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('npx', args, {
      cwd: opts.workspaceRoot,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'inherit']
    });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', rejectPromise);
    child.on('exit', () => {
      // Non-zero exit from the lint target (errors found) is expected; the result is still produced.
      resolvePromise(stdout);
    });
  });
}

interface BuildCacheInput {
  readonly normalized: NormalizedResult;
  readonly linter: LintCacheLinter;
  readonly targetName: string;
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

  for (const r of input.normalized.files) {
    if (r.messages.length === 0) continue;
    const filePath = relative(input.workspaceRoot, r.filePath) || r.filePath;
    filesWithIssues += 1;

    let fileErrors = 0;
    let fileWarnings = 0;

    for (const m of r.messages) {
      if (m.severity === 'error') {
        fileErrors += 1;
        if (m.fixable) fixableErrorCount += 1;
      } else {
        fileWarnings += 1;
        if (m.fixable) fixableWarningCount += 1;
      }

      messages.push({
        filePath,
        line: m.line,
        column: m.column,
        endLine: m.endLine,
        endColumn: m.endColumn,
        ruleId: m.ruleId,
        severity: m.severity,
        message: m.message,
        fixable: m.fixable,
        linter: input.linter
      });

      const ruleKey = m.ruleId ?? '(no-rule)';
      let entry = ruleSummariesMap.get(ruleKey);
      if (!entry) {
        entry = { errors: 0, warnings: 0, files: new Set<string>() };
        ruleSummariesMap.set(ruleKey, entry);
      }
      if (m.severity === 'error') entry.errors += 1;
      else entry.warnings += 1;
      entry.files.add(filePath);
    }

    fileSummariesMap.set(filePath, { errors: fileErrors, warnings: fileWarnings });
    errorCount += fileErrors;
    warningCount += fileWarnings;
  }

  const ruleSummaries: LintCacheRuleSummary[] = Array.from(ruleSummariesMap.entries())
    .map(([rule, v]) => ({ rule, errors: v.errors, warnings: v.warnings, files: v.files.size }))
    .sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings) || a.rule.localeCompare(b.rule));

  const fileSummaries: LintCacheFileSummary[] = Array.from(fileSummariesMap.entries())
    .map(([filePath, v]) => ({ filePath, errors: v.errors, warnings: v.warnings }))
    .sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings) || a.filePath.localeCompare(b.filePath));

  const linterVersion = input.linter === 'eslint' ? 'nx-lint-executor' : 'nx-oxlint-target';

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    project: input.project,
    projectRoot: input.projectRoot,
    linter: input.linter,
    linterVersion,
    targetName: input.targetName,
    eslintVersion: linterVersion,
    errorCount,
    warningCount,
    fixableErrorCount,
    fixableWarningCount,
    fileCount: input.normalized.fileCount,
    filesWithIssues,
    ruleSummaries,
    fileSummaries,
    messages
  };
}
