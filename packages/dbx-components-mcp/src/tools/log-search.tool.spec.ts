import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DBX_LOG_PATH_ENV_VAR } from './log-search/discover-logs.js';
import { runLogSearch } from './log-search.tool.js';

const PROJECT = 'dbcomponents';

interface WriteEntryInput {
  readonly root: string;
  readonly project: string;
  readonly name: string;
  readonly body: string;
  readonly ageDays: number;
}

async function writeEntry(input: WriteEntryInput): Promise<string> {
  const dir = join(input.root, input.project);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${input.name}.md`);
  await writeFile(path, input.body, 'utf-8');
  const when = new Date(Date.now() - input.ageDays * 24 * 60 * 60 * 1000);
  await utimes(path, when, when);
  return path;
}

const SAMPLE_BODY = (subject: string, summary: string): string => [`# ${subject}`, '', '```', subject, '', 'Detailed commit body.', '```', '', '## Date', '', '2026-05-20', '', '## Summary', '', summary, '', '## Files', '', '- `src/example.ts` — example modification'].join('\n');

describe('dbx_log_search', () => {
  let root: string;
  const originalEnv = process.env[DBX_LOG_PATH_ENV_VAR];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dbx-log-search-'));
    delete process.env[DBX_LOG_PATH_ENV_VAR];
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env[DBX_LOG_PATH_ENV_VAR];
    } else {
      process.env[DBX_LOG_PATH_ENV_VAR] = originalEnv;
    }
    await rm(root, { recursive: true, force: true });
  });

  it('returns isError when no base path is configured', async () => {
    const result = await runLogSearch({ project: PROJECT });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No log path configured');
  });

  it('returns isError when configured base path does not exist', async () => {
    const result = await runLogSearch({ basePath: join(root, 'does-not-exist'), project: PROJECT });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Log path does not exist');
  });

  it('list mode enumerates recent entries by default', async () => {
    await writeEntry({ root, project: PROJECT, name: 'add-feature-x', body: SAMPLE_BODY('add feature x', 'Adds feature x.'), ageDays: 0 });
    await writeEntry({ root, project: PROJECT, name: 'fix-bug-y', body: SAMPLE_BODY('fix bug y', 'Fixes bug y.'), ageDays: 1 });
    const result = await runLogSearch({ basePath: root, project: PROJECT });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('mode: list');
    expect(result.content[0].text).toContain('add feature x');
    expect(result.content[0].text).toContain('fix bug y');
  });

  it('list mode excludes entries outside the window', async () => {
    await writeEntry({ root, project: PROJECT, name: 'recent', body: SAMPLE_BODY('recent', 'recent change'), ageDays: 0 });
    await writeEntry({ root, project: PROJECT, name: 'ancient', body: SAMPLE_BODY('ancient', 'ancient change'), ageDays: 30 });
    const result = await runLogSearch({ basePath: root, project: PROJECT, days: 3 });
    expect(result.content[0].text).toContain('recent');
    expect(result.content[0].text).not.toContain('ancient change');
  });

  it('honors a wider `days` window', async () => {
    await writeEntry({ root, project: PROJECT, name: 'older', body: SAMPLE_BODY('older', 'older change'), ageDays: 10 });
    const result = await runLogSearch({ basePath: root, project: PROJECT, days: 30 });
    expect(result.content[0].text).toContain('older');
  });

  it('fuzzy mode ranks higher-weighted matches first', async () => {
    await writeEntry({ root, project: PROJECT, name: 'circleci-runner', body: SAMPLE_BODY('add circleci runner', 'Adds the CircleCI runner.'), ageDays: 0 });
    await writeEntry({ root, project: PROJECT, name: 'misc', body: SAMPLE_BODY('misc cleanup', 'Mentions circleci once in passing.'), ageDays: 0 });
    const result = await runLogSearch({ basePath: root, project: PROJECT, query: 'circleci' });
    const text = result.content[0].text;
    expect(text).toContain('mode: fuzzy');
    expect(text.indexOf('add circleci runner')).toBeLessThan(text.indexOf('misc cleanup'));
  });

  it('keyword mode includes the matched line snippet', async () => {
    await writeEntry({ root, project: PROJECT, name: 'nx-cache', body: SAMPLE_BODY('cache stabilization', 'Pins the nx cache so jobs see the same hash.'), ageDays: 0 });
    const result = await runLogSearch({ basePath: root, project: PROJECT, query: 'pins the nx cache', mode: 'keyword' });
    const text = result.content[0].text;
    expect(text).toContain('mode: keyword');
    expect(text).toContain('Pins the nx cache so jobs see the same hash.');
  });

  it('reports zero matches gracefully in fuzzy mode', async () => {
    await writeEntry({ root, project: PROJECT, name: 'foo', body: SAMPLE_BODY('foo', 'Foo summary.'), ageDays: 0 });
    const result = await runLogSearch({ basePath: root, project: PROJECT, query: 'zzznevermatches' });
    expect(result.content[0].text).toContain('No matches');
  });

  it('searches every project when project is "all"', async () => {
    await writeEntry({ root, project: 'a', name: 'one', body: SAMPLE_BODY('one', 'in project a'), ageDays: 0 });
    await writeEntry({ root, project: 'b', name: 'two', body: SAMPLE_BODY('two', 'in project b'), ageDays: 0 });
    const result = await runLogSearch({ basePath: root, project: 'all' });
    const text = result.content[0].text;
    expect(text).toContain('scope: all projects');
    expect(text).toContain('one');
    expect(text).toContain('two');
  });

  it('falls back to siblings when includeSiblings is set and project is empty', async () => {
    await writeEntry({ root, project: 'sibling', name: 'hello', body: SAMPLE_BODY('hello sibling', 'In sibling.'), ageDays: 0 });
    const result = await runLogSearch({ basePath: root, project: PROJECT, includeSiblings: true });
    const text = result.content[0].text;
    expect(text).toContain('scope: dbcomponents');
    expect(text).toContain('hello sibling');
  });

  it('reads basePath from DBX_LOG_PATH when not passed', async () => {
    await writeEntry({ root, project: PROJECT, name: 'env-test', body: SAMPLE_BODY('env test', 'via env.'), ageDays: 0 });
    process.env[DBX_LOG_PATH_ENV_VAR] = root;
    const result = await runLogSearch({ project: PROJECT });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('env test');
  });

  it('falls back to config basePath when arg and env are both unset', async () => {
    await writeEntry({ root, project: PROJECT, name: 'config-test', body: SAMPLE_BODY('config test', 'via config.'), ageDays: 0 });
    const result = await runLogSearch({ project: PROJECT }, { basePath: root });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('config test');
  });

  it('uses config defaultProject when no project arg is given', async () => {
    await writeEntry({ root, project: 'custom-default', name: 'pick-me', body: SAMPLE_BODY('pick me', 'In the configured default project.'), ageDays: 0 });
    const result = await runLogSearch({ basePath: root }, { defaultProject: 'custom-default' });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('scope: custom-default');
    expect(text).toContain('pick me');
  });

  it('per-call basePath arg wins over the config fallback', async () => {
    await writeEntry({ root, project: PROJECT, name: 'arg-win', body: SAMPLE_BODY('arg wins', 'Picked from the per-call arg.'), ageDays: 0 });
    const result = await runLogSearch({ basePath: root, project: PROJECT }, { basePath: join(root, 'does-not-exist') });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('arg wins');
  });

  it('DBX_LOG_PATH env wins over the config fallback', async () => {
    await writeEntry({ root, project: PROJECT, name: 'env-win', body: SAMPLE_BODY('env wins', 'Picked from the env var.'), ageDays: 0 });
    process.env[DBX_LOG_PATH_ENV_VAR] = root;
    const result = await runLogSearch({ project: PROJECT }, { basePath: join(root, 'does-not-exist') });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('env wins');
  });

  it('falls back to the filename stem when the H1 title is missing', async () => {
    const body = ['## Summary', '', 'Has no H1.'].join('\n');
    await writeEntry({ root, project: PROJECT, name: 'fallback-title', body, ageDays: 0 });
    const result = await runLogSearch({ basePath: root, project: PROJECT });
    expect(result.content[0].text).toContain('### fallback-title');
  });
});
