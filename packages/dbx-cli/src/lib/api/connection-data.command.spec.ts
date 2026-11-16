import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE, microsoftMailSignatureUserExternalConnectionDataTypeConfig } from '@dereekb/firebase';
import { type CliContext, setCliContext } from '../context/cli.context';
import { configureOutputOptions } from '../util/output';
import { CONNECTION_DATA_REFRESH_HINT, buildConnectionDataCommand, readImportSettings } from './connection-data.command';
import { type CliExternalConnectionDataConfig, passthroughCliExternalConnectionDataAdapter } from './external-connection-data';

const VALUE_SENTINEL = 'sentinel-connection-data-value-5678';

const CONFIG: CliExternalConnectionDataConfig = {
  dataTypes: [microsoftMailSignatureUserExternalConnectionDataTypeConfig('microsoft')],
  adapters: { microsoft: passthroughCliExternalConnectionDataAdapter({ dataTypes: [MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE] }) }
};

const ITEMS = [{ providerType: 'microsoft', dataType: 'mail_signature', itemKey: 'me', bytes: 42, updatedAt: '2026-11-13T00:00:00.000Z' }];

describe('buildConnectionDataCommand()', () => {
  let stdout: string[] = [];
  let tempDir: string;
  let callModel: ReturnType<typeof vi.fn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  async function run(args: string[], config: CliExternalConnectionDataConfig = CONFIG): Promise<any> {
    await yargs(args)
      .command(buildConnectionDataCommand({ cliName: 'demo-cli', config }))
      .exitProcess(false)
      .fail((msg: string, err: Error | undefined) => {
        throw err ?? new Error(msg);
      })
      .parseAsync();

    return JSON.parse(stdout.join(''));
  }

  beforeEach(() => {
    stdout = [];
    tempDir = mkdtempSync(join(tmpdir(), 'dbx-cli-connection-data-'));
    callModel = vi.fn(async (params: { readonly call: string }) => (params.call === 'read' ? { items: ITEMS, dataTypes: [], data: { microsoft: { mail_signature: { me: { text: VALUE_SENTINEL } } } } } : { items: ITEMS }));
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout.push(typeof chunk === 'string' ? chunk : chunk.toString());
      return true;
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation((arg: any) => {
      stdout.push(`${String(arg)}\n`);
    });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
    setCliContext({
      cliName: 'demo-cli',
      envName: 'local',
      env: { apiBaseUrl: 'http://localhost/api', oidcIssuer: 'http://localhost/oidc' },
      accessToken: 'cli-access-token',
      callModel: callModel as never,
      getModel: (async () => ({ key: '', data: null })) as never,
      getMultipleModels: (async () => ({ results: [], errors: [] })) as never
    } as CliContext);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    setCliContext(undefined);
    configureOutputOptions({});
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('list reads keys only and prints no values', async () => {
    const parsed = await run(['connection-data', 'list', 'microsoft']);

    expect(callModel).toHaveBeenCalledWith({ modelType: 'userExternalConnection', call: 'read', specifier: 'data', data: { providerType: 'microsoft', keysOnly: true } });
    expect(parsed.data).toEqual({ items: ITEMS, dataTypes: [] });
    expect(stdout.join('')).not.toContain(VALUE_SENTINEL);
  });

  it('get prints the provider values and normalizes the item key', async () => {
    const parsed = await run(['connection-data', 'get', 'microsoft', 'mail_signature', 'Support@Example.com']);

    expect(callModel).toHaveBeenCalledWith({ modelType: 'userExternalConnection', call: 'read', specifier: 'data', data: { providerType: 'microsoft', dataType: 'mail_signature', itemKey: 'support@example.com' } });
    expect(parsed.data.data).toEqual({ mail_signature: { me: { text: VALUE_SENTINEL } } });
  });

  it('set --file packs the file with the data type and normalizes the key', async () => {
    const file = join(tempDir, 'signature.html');
    writeFileSync(file, '  <p>Thanks</p>\n');

    const parsed = await run(['connection-data', 'set', 'microsoft', 'mail_signature', 'ME', '--file', file]);

    expect(callModel).toHaveBeenCalledWith({ modelType: 'userExternalConnection', call: 'update', specifier: 'data', data: { providerType: 'microsoft', set: [{ dataType: 'mail_signature', itemKey: 'me', value: { html: '<p>Thanks</p>' } }] } });
    expect(parsed.data.next).toBe(CONNECTION_DATA_REFRESH_HINT);
  });

  it('set --json sends the parsed object', async () => {
    await run(['connection-data', 'set', 'microsoft', 'mail_signature', 'me', '--json', '{"text":"Hi"}']);
    expect(callModel.mock.calls[0][0].data.set[0].value).toEqual({ text: 'Hi' });
  });

  it('refuses --file for a data type without packFile', async () => {
    await expect(run(['connection-data', 'set', 'other', 'thing', 'me', '--file', join(tempDir, 'x.txt')])).rejects.toThrow('process.exit:1');

    expect(JSON.parse(stdout.join('')).code).toBe('INVALID_ARGUMENT');
    expect(callModel).not.toHaveBeenCalled();
  });

  it('refuses invalid --json without echoing it', async () => {
    await expect(run(['connection-data', 'set', 'microsoft', 'mail_signature', 'me', '--json', `{${VALUE_SENTINEL}`])).rejects.toThrow('process.exit:1');

    expect(stdout.join('')).not.toContain(VALUE_SENTINEL);
    expect(callModel).not.toHaveBeenCalled();
  });

  it('refuses an invalid item key before calling the server', async () => {
    await expect(run(['connection-data', 'set', 'microsoft', 'mail_signature', 'not an address', '--json', '{"text":"Hi"}'])).rejects.toThrow('process.exit:1');

    expect(JSON.parse(stdout.join('')).code).toBe('INVALID_ARGUMENT');
    expect(callModel).not.toHaveBeenCalled();
  });

  it('unset sends one unset operation', async () => {
    await run(['connection-data', 'unset', 'microsoft', 'mail_signature', 'me']);
    expect(callModel.mock.calls[0][0].data).toEqual({ providerType: 'microsoft', unset: [{ dataType: 'mail_signature', itemKey: 'me' }] });
  });

  it('import accepts a CLI envelope, packs it with the adapter, and --replace clears', async () => {
    const file = join(tempDir, 'settings.json');
    writeFileSync(file, JSON.stringify({ ok: true, data: { mail_signature: { me: { html: '<p>A</p>' }, 'Support@Example.com': { text: 'B' } }, unrelated: { x: { y: 1 } } } }));

    const parsed = await run(['connection-data', 'import', 'microsoft', '--file', file, '--replace']);

    expect(callModel.mock.calls[0][0].data).toEqual({
      providerType: 'microsoft',
      set: [
        { dataType: 'mail_signature', itemKey: 'me', value: { html: '<p>A</p>' } },
        { dataType: 'mail_signature', itemKey: 'support@example.com', value: { text: 'B' } }
      ],
      clear: true
    });
    expect(parsed.data.imported).toBe(2);
  });

  it('refuses import for a provider without a pack adapter', async () => {
    const file = join(tempDir, 'settings.json');
    writeFileSync(file, '{}');

    await expect(run(['connection-data', 'import', 'zoho', '--file', file])).rejects.toThrow('process.exit:1');
    expect(JSON.parse(stdout.join('')).code).toBe('INVALID_ARGUMENT');
  });

  it('reports a missing file without its content', async () => {
    await expect(run(['connection-data', 'import', 'microsoft', '--file', join(tempDir, 'missing.json')])).rejects.toThrow('process.exit:1');
    expect(JSON.parse(stdout.join('')).error).toContain('ENOENT');
  });
});

describe('readImportSettings()', () => {
  it('reads a bare settings object', () => {
    expect(readImportSettings('{"mail_signature":{}}')).toEqual({ mail_signature: {} });
  });

  it('unwraps an ok envelope', () => {
    expect(readImportSettings('{"ok":true,"data":{"a":{}}}')).toEqual({ a: {} });
  });

  it('refuses a non-object', () => {
    expect(() => readImportSettings('[1]')).toThrow('must be a JSON object');
  });
});
