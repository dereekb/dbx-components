import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mcpConfigTool } from './mcp-config.tool.js';

describe('dbx_mcp_config', () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'dbx-mcp-config-'));
  });

  afterEach(async () => {
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it('rejects invalid op', async () => {
    const result = await mcpConfigTool.run({ op: 'nope', cwd: workspaceRoot });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  describe('op="status"', () => {
    it('reports an empty workspace cleanly', async () => {
      const result = await mcpConfigTool.run({ op: 'status', cwd: workspaceRoot });
      const text = result.content[0].text;
      expect(text).toContain('# dbx-mcp config status');
      expect(text).toContain('**Downstream packages:** 0');
      expect(text).toContain('not present');
      expect(result.isError).toBeFalsy();
    });

    it('lists candidate clusters and unregistered packages', async () => {
      await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.component.ts': '', 'bar.pipe.ts': '' } });
      const result = await mcpConfigTool.run({ op: 'status', cwd: workspaceRoot });
      const text = result.content[0].text;
      expect(text).toContain('## UI components');
      expect(text).toContain('## Pipes');
      expect(text).toContain('Candidate packages without registration');
      expect(text).toContain('components/demo-shared');
      expect(text).toContain('Run `dbx_mcp_config op="init"`');
    });
  });

  describe('op="validate"', () => {
    it('passes with no issues on an empty workspace', async () => {
      const result = await mcpConfigTool.run({ op: 'validate', cwd: workspaceRoot });
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('No issues detected');
    });

    it('errors when registered source is missing on disk', async () => {
      await writeFile(join(workspaceRoot, 'dbx-mcp.config.json'), JSON.stringify({ version: 1, uiComponents: { sources: ['.tmp/dbx-mcp/missing.uiComponents.json'] } }), 'utf8');
      const result = await mcpConfigTool.run({ op: 'validate', cwd: workspaceRoot });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('does not exist on disk');
    });

    it('warns when a candidate package is unregistered', async () => {
      await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.component.ts': '' } });
      const result = await mcpConfigTool.run({ op: 'validate', cwd: workspaceRoot });
      expect(result.isError).toBeFalsy();
      const text = result.content[0].text;
      expect(text).toContain('Warnings:** 1');
      expect(text).toContain('components/demo-shared');
    });
  });

  describe('op="init"', () => {
    it('writes scan and config files for a candidate package', async () => {
      await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.component.ts': '', 'bar.pipe.ts': '' } });
      const result = await mcpConfigTool.run({ op: 'init', cwd: workspaceRoot });
      const text = result.content[0].text;
      expect(text).toContain('Files written');
      expect(text).toContain('components/demo-shared/dbx-mcp.scan.json');
      expect(text).toContain('dbx-mcp.config.json');

      const scanRaw = await readFile(join(workspaceRoot, 'components/demo-shared/dbx-mcp.scan.json'), 'utf8');
      const scan = JSON.parse(scanRaw) as Record<string, unknown>;
      expect(scan.version).toBe(1);
      expect(scan.uiComponents).toBeDefined();
      expect(scan.pipes).toBeDefined();
      expect((scan.uiComponents as Record<string, unknown>).out).toBe('../../.tmp/dbx-mcp/demo-shared.uiComponents.json');

      const configRaw = await readFile(join(workspaceRoot, 'dbx-mcp.config.json'), 'utf8');
      const config = JSON.parse(configRaw) as Record<string, { sources: string[] }>;
      expect(config.uiComponents.sources).toContain('.tmp/dbx-mcp/demo-shared.uiComponents.json');
      expect(config.pipes.sources).toContain('.tmp/dbx-mcp/demo-shared.pipes.json');
    });

    it('dryRun does not write files', async () => {
      await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.component.ts': '' } });
      const result = await mcpConfigTool.run({ op: 'init', cwd: workspaceRoot, dryRun: true });
      expect(result.content[0].text).toContain('dry run');
      expect(result.content[0].text).toContain('Files that would be written');
      let scanExists = false;
      try {
        await readFile(join(workspaceRoot, 'components/demo-shared/dbx-mcp.scan.json'), 'utf8');
        scanExists = true;
      } catch {
        scanExists = false;
      }
      expect(scanExists).toBe(false);
    });

    it('preserves user-customized scan section out paths', async () => {
      await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.component.ts': '' } });
      await writeFile(join(workspaceRoot, 'components/demo-shared/dbx-mcp.scan.json'), JSON.stringify({ version: 1, uiComponents: { include: ['custom/**/*.ts'], out: 'custom-out.json' } }), 'utf8');
      await mcpConfigTool.run({ op: 'init', cwd: workspaceRoot });
      const scanRaw = await readFile(join(workspaceRoot, 'components/demo-shared/dbx-mcp.scan.json'), 'utf8');
      const scan = JSON.parse(scanRaw) as Record<string, Record<string, unknown>>;
      expect(scan.uiComponents.out).toBe('custom-out.json');
      expect((scan.uiComponents.include as string[])[0]).toBe('custom/**/*.ts');

      const configRaw = await readFile(join(workspaceRoot, 'dbx-mcp.config.json'), 'utf8');
      const config = JSON.parse(configRaw) as Record<string, { sources: string[] }>;
      expect(config.uiComponents.sources).toContain('components/demo-shared/custom-out.json');
    });

    it('is idempotent — re-running yields no changes', async () => {
      await scaffoldPackage({ workspaceRoot, relDir: 'components/demo-shared', packageName: 'demo-shared', files: { 'foo.component.ts': '' } });
      await mcpConfigTool.run({ op: 'init', cwd: workspaceRoot });
      const second = await mcpConfigTool.run({ op: 'init', cwd: workspaceRoot });
      expect(second.content[0].text).toContain('Unchanged:** 2');
    });
  });

  describe('op="refresh"', () => {
    it('reports nothing-to-refresh when no scan configs exist', async () => {
      const result = await mcpConfigTool.run({ op: 'refresh', cwd: workspaceRoot });
      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Nothing to refresh');
    });
  });
});

interface ScaffoldInput {
  readonly workspaceRoot: string;
  readonly relDir: string;
  readonly packageName: string;
  readonly files: Record<string, string>;
}

async function scaffoldPackage(input: ScaffoldInput): Promise<void> {
  const dir = join(input.workspaceRoot, input.relDir);
  await mkdir(join(dir, 'src/lib'), { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: input.packageName }), 'utf8');
  for (const [filename, content] of Object.entries(input.files)) {
    await writeFile(join(dir, 'src/lib', filename), content, 'utf8');
  }
}
