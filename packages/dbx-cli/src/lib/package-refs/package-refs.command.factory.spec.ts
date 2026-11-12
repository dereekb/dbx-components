import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import yargs from 'yargs';
import { type EmbeddedPackageRefs } from './package-refs';
import { createPackageRefsDocsCommand, DOCS_TOPIC_AMBIGUOUS_ERROR_CODE, DOCS_TOPIC_NOT_FOUND_ERROR_CODE } from './package-refs.command.factory';

const ALPHA_REF = '---\nname: alpha\ndescription: The alpha ref.\n---\n\n# Alpha\n\nSee `shared`.\n';

const TEST_REFS: EmbeddedPackageRefs = {
  packageName: '@acme/pkg',
  refs: [
    { name: 'alpha', content: ALPHA_REF, docs: { shared: '# Alpha Shared\n' } },
    { name: 'beta', content: '# Beta\n', docs: { shared: '# Beta Shared\n' } }
  ]
};

describe('createPackageRefsDocsCommand()', () => {
  let stdout: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      stdout += String(chunk);
      return true;
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      stdout += args.map(String).join(' ');
    });
    // `wrapCommandHandler` exits the process on a thrown CliError; without this the vitest worker would go down with it
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null): never => {
      throw new Error(`process.exit:${code ?? 0}`);
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    logSpy.mockRestore();
    exitSpy.mockRestore();
  });

  async function run(args: readonly string[]): Promise<Error | undefined> {
    let captured: Error | undefined;

    try {
      await yargs([...args])
        .command(createPackageRefsDocsCommand({ cliName: 'acme-cli', refs: TEST_REFS }))
        .strict()
        .exitProcess(false)
        .fail(false)
        .parseAsync();
    } catch (e) {
      captured = e as Error;
    }

    return captured;
  }

  it('should print the markdown index with no topic', async () => {
    expect(await run(['docs'])).toBeUndefined();
    expect(stdout).toContain('# acme-cli docs');
    expect(stdout).toContain('- `alpha`: Alpha — The alpha ref.');
    expect(stdout).toContain('- `beta/shared`: Beta Shared');
  });

  it('should print a ref verbatim', async () => {
    expect(await run(['docs', 'alpha'])).toBeUndefined();
    expect(stdout).toBe(ALPHA_REF);
  });

  it('should print a sub-doc by <ref>/<doc>', async () => {
    expect(await run(['docs', 'beta/shared'])).toBeUndefined();
    expect(stdout).toBe('# Beta Shared\n');
  });

  it('should wrap the index in the JSON envelope with --json', async () => {
    expect(await run(['docs', '--json'])).toBeUndefined();
    const output = JSON.parse(stdout);
    expect(output.ok).toBe(true);
    expect(output.data.packageName).toBe('@acme/pkg');
    expect(output.data.topics.map((x: { topic: string }) => x.topic)).toEqual(['alpha', 'alpha/shared', 'beta', 'beta/shared']);
  });

  it('should wrap a topic in the JSON envelope with --json', async () => {
    expect(await run(['docs', 'alpha', '--json'])).toBeUndefined();
    const output = JSON.parse(stdout);
    expect(output.data).toEqual({ packageName: '@acme/pkg', topic: 'alpha', content: ALPHA_REF });
  });

  it('should fail with DOCS_TOPIC_NOT_FOUND for an unknown topic', async () => {
    const error = await run(['docs', 'nope']);
    expect(error?.message).toBe('process.exit:1');
    const output = JSON.parse(stdout);
    expect(output.ok).toBe(false);
    expect(output.code).toBe(DOCS_TOPIC_NOT_FOUND_ERROR_CODE);
    expect(output.suggestion).toContain('alpha/shared');
  });

  it('should fail with DOCS_TOPIC_AMBIGUOUS for a bare doc key two refs share', async () => {
    const error = await run(['docs', 'shared']);
    expect(error?.message).toBe('process.exit:1');
    const output = JSON.parse(stdout);
    expect(output.code).toBe(DOCS_TOPIC_AMBIGUOUS_ERROR_CODE);
    expect(output.suggestion).toContain('alpha/shared, beta/shared');
  });
});
