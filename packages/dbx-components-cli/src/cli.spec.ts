/**
 * Smoke specs for the CLI wiring — confirm yargs dispatches each command to the
 * library scanner and prints the rendered output. Paths are resolved absolutely
 * from __dirname so the test does not depend on the process cwd.
 */

import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDbxComponentsCli } from './cli.js';

const DEMO_API_ABS = resolve(__dirname, '../../../apps/demo-api');

function captureStdout(): { readonly output: () => string; readonly restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    chunks.push(args.map((a) => String(a)).join(' '));
  });
  return { output: () => chunks.join('\n'), restore: () => spy.mockRestore() };
}

describe('dbx-components-cli', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('fixture list — renders the demo-api fixtures as JSON', async () => {
    const cap = captureStdout();
    await runDbxComponentsCli(['fixture', 'list', DEMO_API_ABS, '--json']);
    cap.restore();
    const text = cap.output();
    expect(text).toContain('"prefix": "DemoApi"');
    expect(text).toContain('Guestbook');
    expect(process.exitCode).toBeUndefined();
  });

  it('fixture lookup — renders one model triplet', async () => {
    const cap = captureStdout();
    await runDbxComponentsCli(['fixture', 'lookup', DEMO_API_ABS, 'Guestbook']);
    cap.restore();
    expect(cap.output()).toContain('Guestbook');
    expect(process.exitCode).toBeUndefined();
  });

  it('fixture lookup — exits non-zero for an unknown model', async () => {
    const cap = captureStdout();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await runDbxComponentsCli(['fixture', 'lookup', DEMO_API_ABS, 'NotARealModel']);
    cap.restore();
    errSpy.mockRestore();
    expect(process.exitCode).toBe(1);
  });

  it('spec list — inventories the demo-api spec files', async () => {
    const cap = captureStdout();
    await runDbxComponentsCli(['spec', 'list', DEMO_API_ABS, '--json']);
    cap.restore();
    expect(cap.output().length).toBeGreaterThan(0);
    expect(process.exitCode).toBeUndefined();
  });
});
