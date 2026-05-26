import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type FirebaseServerAuthData } from '@dereekb/firebase-server';
import { type AuthClaims, type AuthRoleSet } from '@dereekb/util';
import { type McpManifestAuth, type McpManifestAuthApp, type McpManifestAuthClaim } from '../mcp.manifest';
import { type McpStaticToolHandlerContext } from '../mcp.tool-generator';
import { createWhoamiTool, WHOAMI_TOOL_NAME, type WhoamiToolOutput } from './mcp.tool.whoami';

const DEMO_APP: McpManifestAuthApp = {
  app: 'demo-api',
  claimsInterfaceName: 'DemoApiAuthClaims',
  serviceConstName: 'DEMO_AUTH_CLAIMS_SERVICE',
  claimKeys: ['o', 'a', 'fr'],
  scopes: ['model.read']
};

const ONBOARDED_CLAIM: McpManifestAuthClaim = {
  key: 'o',
  description: 'Onboarded flag — set when the user has signed TOS and completed onboarding.',
  type: '1',
  app: 'demo-api',
  interfaceName: 'DemoApiAuthClaims',
  source: 'app',
  mapping: { roles: ['tos', 'onboarded'], inverse: false, customEncodeDecode: false },
  tags: []
};

const ADMIN_CLAIM: McpManifestAuthClaim = {
  key: 'a',
  description: 'Admin role — grants full access to admin-only sections of the app.',
  type: '1',
  app: 'demo-api',
  interfaceName: 'DemoApiAuthClaims',
  source: 'app',
  mapping: { roles: ['admin'], inverse: false, customEncodeDecode: false },
  tags: []
};

const FR_CLAIM: McpManifestAuthClaim = {
  key: 'fr',
  description: 'StorageFile upload restriction.',
  type: 'StorageFileUploadUserRestriction',
  interfaceName: 'StorageFileUploadUserClaims',
  source: 'system',
  mapping: { roles: ['storageFileUploadUser'], inverse: false, customEncodeDecode: false },
  tags: []
};

function makeAuth(): McpManifestAuth {
  return { app: DEMO_APP, apps: [DEMO_APP], claims: [ONBOARDED_CLAIM, ADMIN_CLAIM, FR_CLAIM] };
}

function makeCtx(input: { readonly auth?: FirebaseServerAuthData }): McpStaticToolHandlerContext {
  return { ...input, rawRequest: {} as unknown as McpStaticToolHandlerContext['rawRequest'] };
}

function makeAuthData(uid: string, token: Record<string, unknown>): FirebaseServerAuthData {
  return { uid, token: token as unknown as FirebaseServerAuthData['token'] } as FirebaseServerAuthData;
}

function unwrap(result: CallToolResult): WhoamiToolOutput {
  return result.structuredContent as unknown as WhoamiToolOutput;
}

function readText(result: CallToolResult): string {
  const first = result.content[0];
  if (first.type !== 'text') {
    throw new Error('expected text content');
  }
  return first.text;
}

describe('createWhoamiTool', () => {
  it('exposes a read-only static tool with no input', () => {
    const tool = createWhoamiTool({ auth: makeAuth() });

    expect(tool.name).toBe(WHOAMI_TOOL_NAME);
    expect(tool.dispatch).toEqual({ call: 'read', modelType: 'auth' });
    expect(tool.staticHandler).toBeDefined();
    expect(tool.filterMetadata.effectiveReadOnly).toBe(true);
    expect(tool.filterMetadata.visibilityKind).toBe('declarative');

    if (tool.filterMetadata.visibilityKind === 'declarative') {
      expect(tool.filterMetadata.rule.requireAuthenticated).toBeUndefined();
    }

    expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false, properties: {} });
    expect(tool.outputSchema).toMatchObject({ type: 'object' });
  });

  it('mentions the host app slug in the description', () => {
    const tool = createWhoamiTool({ auth: makeAuth() });
    expect(tool.description).toContain('`demo-api`');
  });

  it('returns authenticated: false for anonymous callers', async () => {
    const tool = createWhoamiTool({ auth: makeAuth() });
    const result = await tool.staticHandler!({}, makeCtx({}));
    const output = unwrap(result);

    expect(output.authenticated).toBe(false);
    expect(output.uid).toBeUndefined();
    expect(output.claims).toEqual({});
    expect(output.roles).toEqual([]);
    expect(output.claimDetails).toEqual([]);
    expect(output.unknownClaimKeys).toEqual([]);
    expect(readText(result)).toContain('Unauthenticated');
  });

  it('renders only the claim keys present on the live token', async () => {
    const roleReader = (_claims: AuthClaims): AuthRoleSet => new Set(['tos', 'onboarded']);
    const tool = createWhoamiTool({ auth: makeAuth(), roleReader });

    const result = await tool.staticHandler!({}, makeCtx({ auth: makeAuthData('user-1', { o: 1 }) }));
    const output = unwrap(result);

    expect(output.authenticated).toBe(true);
    expect(output.uid).toBe('user-1');
    expect(output.app).toBe('demo-api');
    expect(output.roles).toEqual(['onboarded', 'tos']);
    expect(output.claimDetails).toHaveLength(1);
    expect(output.claimDetails[0]).toMatchObject({ key: 'o', interfaceName: 'DemoApiAuthClaims' });
    expect(output.claimDetails[0].grantedRoles).toEqual(['tos', 'onboarded']);
    expect(output.unknownClaimKeys).toEqual([]);
  });

  it('includes multiple claim entries when the token carries multiple roles', async () => {
    const roleReader = (_claims: AuthClaims): AuthRoleSet => new Set(['tos', 'onboarded', 'admin']);
    const tool = createWhoamiTool({ auth: makeAuth(), roleReader });

    const result = await tool.staticHandler!({}, makeCtx({ auth: makeAuthData('user-2', { o: 1, a: 1 }) }));
    const output = unwrap(result);

    expect(output.claimDetails.map((d) => d.key)).toEqual(['o', 'a']);
    const text = readText(result);
    expect(text).toContain('`o` on `DemoApiAuthClaims`');
    expect(text).toContain('`a` on `DemoApiAuthClaims`');
    expect(text).not.toContain('`fr` on');
  });

  it('lands a token-present claim key as unknown when the manifest has no matching entry', async () => {
    const tool = createWhoamiTool({ auth: makeAuth() });
    const result = await tool.staticHandler!({}, makeCtx({ auth: makeAuthData('user-3', { o: 1, x: 'mystery' }) }));
    const output = unwrap(result);

    expect(output.claimDetails.map((d) => d.key)).toEqual(['o']);
    expect(output.unknownClaimKeys).toEqual(['x']);
  });

  it('renders an empty roles list when no role reader is configured', async () => {
    const tool = createWhoamiTool({ auth: makeAuth() });
    const result = await tool.staticHandler!({}, makeCtx({ auth: makeAuthData('user-4', { o: 1, a: 1 }) }));
    const output = unwrap(result);

    expect(output.roles).toEqual([]);
    expect(output.claimDetails).toHaveLength(2);
  });
});
