import type { CallToolResult } from '@modelcontextprotocol/server';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { type McpCliTokenMintInput, type McpCliTokenMintResult } from '../../mcp.config';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { type CliTokenToolOutput, createCliTokenTool, DEFAULT_MCP_CLI_TOKEN_CREDENTIAL_TYPE } from './mcp.tool.cli-token';

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

function readText(result: CallToolResult): string {
  const first = result.content[0];

  if (first.type !== 'text') {
    throw new Error('expected text content');
  }

  return first.text;
}

describe('createCliTokenTool', () => {
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
