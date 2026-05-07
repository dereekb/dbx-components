import { describe, expect, it } from 'vitest';
import { BUILTIN_AUTH_CLAIMS, BUILTIN_AUTH_ROLES, BUILTIN_AUTH_SCOPES, WORKSPACE_AUTH_APPS, WORKSPACE_AUTH_CLAIMS } from '../registry/auth-builtin.js';
import { createAuthRegistryFromEntries } from '../registry/auth-runtime.js';
import { createAuthClaimLookupTool } from './auth-claim-lookup.tool.js';
import { createAuthListAppTool } from './auth-list-app.tool.js';
import { createAuthRoleLookupTool } from './auth-role-lookup.tool.js';
import { createAuthScopeLookupTool } from './auth-scope-lookup.tool.js';
import { createAuthTokenExplainTool } from './auth-token-explain.tool.js';

const REGISTRY = createAuthRegistryFromEntries({
  roles: BUILTIN_AUTH_ROLES,
  claims: [...BUILTIN_AUTH_CLAIMS, ...WORKSPACE_AUTH_CLAIMS],
  scopes: BUILTIN_AUTH_SCOPES,
  apps: WORKSPACE_AUTH_APPS,
  loadedSources: ['test']
});

function textOf(result: { readonly content: readonly { readonly type: 'text'; readonly text: string }[] }): string {
  return result.content.map((c) => c.text).join('\n');
}

describe('dbx_auth_claim_lookup', () => {
  const tool = createAuthClaimLookupTool({ registry: REGISTRY });

  it('rejects empty arguments', async () => {
    const result = await tool.run({});
    expect(result.isError).toBe(true);
  });

  it('returns the catalog for topic="list"', async () => {
    const result = await tool.run({ topic: 'list' });
    const text = textOf(result);
    expect(text).toContain('Auth claim catalog');
    expect(text).toContain('`fr`');
    expect(text).toContain('`o`');
    expect(text).toContain('`a`');
  });

  it('looks up the demo `o` claim and exposes its tags + role mapping', async () => {
    const result = await tool.run({ topic: 'o', app: 'demo-api' });
    const text = textOf(result);
    expect(text).toContain('Claim `o`');
    expect(text).toContain('Onboarded');
    expect(text).toContain('grants');
    expect(text).toContain('`tos`');
    expect(text).toContain('`onboarded`');
    expect(text).toContain('`onboarded`'); // tag
    expect(text).toContain('`verified-user`');
  });

  it('looks up by interface name', async () => {
    const result = await tool.run({ topic: 'DemoApiAuthClaims' });
    const text = textOf(result);
    expect(text).toContain('Claims on `DemoApiAuthClaims`');
    expect(text).toContain('Claim `o`');
    expect(text).toContain('Claim `a`');
  });

  it('handles inverse claims', async () => {
    const result = await tool.run({ topic: 'fr' });
    const text = textOf(result);
    expect(text).toContain('Inverse claim');
    expect(text).toContain('revokes');
    expect(text).toContain('`uploads`');
  });
});

describe('dbx_auth_scope_lookup', () => {
  const tool = createAuthScopeLookupTool({ registry: REGISTRY });

  it('returns a scope entry with enforcement details', async () => {
    const result = await tool.run({ topic: 'model.read' });
    const text = textOf(result);
    expect(text).toContain('Scope `model.read`');
    expect(text).toContain('callType');
    expect(text).toContain('read');
    expect(text).toContain('CALL_MODEL_MISSING_OIDC_SCOPE');
    expect(text).toContain('oidcCallModelScopePreAssert');
  });

  it('lists the catalog', async () => {
    const result = await tool.run({ topic: 'list' });
    const text = textOf(result);
    expect(text).toContain('OIDC scope catalog');
    expect(text).toContain('`model.create`');
    expect(text).toContain('`model.delete`');
  });
});

describe('dbx_auth_role_lookup', () => {
  const tool = createAuthRoleLookupTool({ registry: REGISTRY });

  it('errors when no inputs are provided', async () => {
    const result = await tool.run({});
    expect(result.isError).toBe(true);
  });

  it('looks up by role string', async () => {
    const result = await tool.run({ topic: 'admin' });
    const text = textOf(result);
    expect(text).toContain('Role `admin`');
    expect(text).toContain('AUTH_ADMIN_ROLE');
    expect(text).toContain('`a` (demo-api)');
  });

  it('looks up by const name', async () => {
    const result = await tool.run({ topic: 'AUTH_ONBOARDED_ROLE' });
    const text = textOf(result);
    expect(text).toContain('Role `onboarded`');
  });

  it('filters by tag', async () => {
    const result = await tool.run({ tag: 'privileged' });
    const text = textOf(result);
    expect(text).toContain('Roles tagged `privileged`');
    expect(text).toContain('Role `admin`');
  });

  it('reverse lookup surfaces scopes for a CRUD verb', async () => {
    const result = await tool.run({ model: 'StorageFile', verb: 'read' });
    const text = textOf(result);
    expect(text).toContain('Reverse lookup');
    expect(text).toContain('Required scopes');
    expect(text).toContain('`model.read`');
  });
});

describe('dbx_auth_token_explain', () => {
  const tool = createAuthTokenExplainTool({ registry: REGISTRY });

  it('rejects when neither token nor claims is supplied', async () => {
    const result = await tool.run({});
    expect(result.isError).toBe(true);
  });

  it('rejects when both are supplied', async () => {
    const result = await tool.run({ token: 'a.b.c', claims: { o: 1 } });
    expect(result.isError).toBe(true);
  });

  it('annotates a claims object with catalogued meanings', async () => {
    const result = await tool.run({ claims: { iss: 'https://demo.example', exp: 4102444800, scope: 'model.read model.write', a: 1, fr: 1 }, app: 'demo-api' });
    const text = textOf(result);
    expect(text).toContain('Reserved claims');
    expect(text).toContain('OIDC scopes');
    expect(text).toContain('`model.read`');
    expect(text).toContain('Custom claims');
    expect(text).toContain('grants');
    expect(text).toContain('revokes');
  });

  it('flags expired tokens', async () => {
    const result = await tool.run({ claims: { exp: 1 } });
    const text = textOf(result);
    expect(text).toContain('Warnings');
    expect(text).toContain('expired');
  });

  it('decodes a real-shaped JWT', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: 4102444800, scope: 'model.read', a: 1 })).toString('base64url');
    const token = `${header}.${payload}.sig`;
    const result = await tool.run({ token, app: 'demo-api' });
    const text = textOf(result);
    expect(text).toContain('Header');
    expect(text).toContain('Custom claims');
    expect(text).toContain('grants');
  });
});

describe('dbx_auth_list_app', () => {
  const tool = createAuthListAppTool({ registry: REGISTRY });

  it('lists known apps when app="list"', async () => {
    const result = await tool.run({ app: 'list' });
    const text = textOf(result);
    expect(text).toContain('Apps in auth catalog');
    expect(text).toContain('`demo-api`');
  });

  it('shows the demo-api surface including the inherited `fr` claim', async () => {
    const result = await tool.run({ app: 'demo-api' });
    const text = textOf(result);
    expect(text).toContain('App `demo-api`');
    expect(text).toContain('DemoApiAuthClaims');
    expect(text).toContain('`o`');
    expect(text).toContain('`a`');
    expect(text).toContain('`fr`');
    expect(text).toContain('inherited');
    expect(text).toContain('OIDC scopes');
    expect(text).toContain('`model.read`');
  });

  it('returns a not-found message for unknown apps', async () => {
    const result = await tool.run({ app: 'nope-api' });
    const text = textOf(result);
    expect(text).toContain('No app matched');
  });
});
