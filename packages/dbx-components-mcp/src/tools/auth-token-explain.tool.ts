/**
 * `dbx_auth_token_explain` tool.
 *
 * Decodes a JWT or a plain claims object and annotates each claim with
 * the catalogue entry from {@link AuthRegistry}. Reserved JWT claims
 * (`iss`, `aud`, `exp`, `iat`, `sub`, `scope`, …) are flagged separately
 * and the tool warns when an `exp` claim is in the past.
 *
 * Pass exactly one of:
 *   - `token`  — a JWT (3 dot-separated base64url segments)
 *   - `claims` — a JSON object of decoded custom claims
 *
 * Optionally pass `app` to scope custom-claim resolution to one app's
 * catalog when the same key appears in multiple apps.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import type { AuthClaimInfo, AuthRegistry } from '../registry/auth-runtime.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

const DBX_AUTH_TOKEN_EXPLAIN_TOOL: Tool = {
  name: 'dbx_auth_token_explain',
  description: ['Decode a JWT or claims object and annotate each claim with the catalogued meaning, role mapping, and source path:line.', '', 'Pass `token` (raw JWT string) **or** `claims` (decoded JSON object). Reserved JWT claims (`iss`/`aud`/`exp`/`iat`/`sub`/`scope`) are listed separately. Flags expired tokens and unknown wrong-issuer claims.'].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      token: { type: 'string', description: 'JWT (3 dot-separated base64url segments).' },
      claims: { type: 'object', description: 'Decoded claims object (alternative to `token`).' },
      app: { type: 'string', description: 'Optional app slug to scope custom-claim lookup.' },
      expectedIssuer: { type: 'string', description: 'Optional expected `iss` value to flag mismatches.' }
    }
  }
};

const TokenArgsType = type({
  'token?': 'string',
  'claims?': 'object',
  'app?': 'string',
  'expectedIssuer?': 'string'
});

interface CreateAuthTokenExplainToolInput {
  readonly registry: AuthRegistry;
}

const RESERVED_JWT_CLAIMS = new Set(['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'scope', 'scp', 'azp', 'auth_time', 'name', 'email', 'email_verified', 'firebase']);

/**
 * Creates the `dbx_auth_token_explain` MCP tool bound to the supplied auth registry.
 *
 * @param input - Tool factory input.
 * @param input.registry - Pre-merged auth registry consulted to translate raw JWT claims into catalogued meanings, role mappings, and per-app surface details.
 * @returns A {@link DbxTool} that decodes a JWT (or claims object) and explains each claim against the registry.
 */
export function createAuthTokenExplainTool(input: CreateAuthTokenExplainToolInput): DbxTool {
  const { registry } = input;
  const tool: DbxTool = {
    definition: DBX_AUTH_TOKEN_EXPLAIN_TOOL,
    run(rawArgs) {
      const parsed = TokenArgsType(rawArgs);
      if (parsed instanceof type.errors) {
        return toolError(`Invalid arguments: ${parsed.summary}`);
      }
      const { token, claims: claimsObj, app, expectedIssuer } = parsed;

      let result: ToolResult;
      if (token !== undefined && claimsObj !== undefined) {
        result = toolError('Pass exactly one of `token` or `claims`, not both.');
      } else if (token === undefined && claimsObj === undefined) {
        result = toolError('Pass either `token` (JWT) or `claims` (object).');
      } else {
        const decoded = token === undefined ? { header: undefined, payload: claimsObj as Record<string, unknown>, signature: undefined } : decodeJwt(token);
        if (decoded === null) {
          result = toolError('Could not decode JWT — expected 3 base64url segments separated by `.`.');
        } else {
          const text = formatExplain({ registry, app, expectedIssuer, header: decoded.header, payload: decoded.payload, signaturePresent: decoded.signature !== undefined });
          result = { content: [{ type: 'text', text }] };
        }
      }
      return result;
    }
  };
  return tool;
}

interface DecodedJwt {
  readonly header: Record<string, unknown> | undefined;
  readonly payload: Record<string, unknown>;
  readonly signature: string | undefined;
}

function decodeJwt(token: string): DecodedJwt | null {
  const parts = token.trim().split('.');
  let result: DecodedJwt | null = null;
  if (parts.length === 3) {
    const [headerSegment, payloadSegment, signature] = parts;
    const header = decodeJwtSegment(headerSegment);
    const payload = decodeJwtSegment(payloadSegment);
    if (payload !== null) {
      result = { header: header ?? undefined, payload, signature };
    }
  }
  return result;
}

function decodeJwtSegment(segment: string): Record<string, unknown> | null {
  let result: Record<string, unknown> | null = null;
  try {
    const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
    const base64 = padded.replaceAll('-', '+').replaceAll('_', '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      result = parsed as Record<string, unknown>;
    }
  } catch {
    result = null;
  }
  return result;
}

interface FormatExplainInput {
  readonly registry: AuthRegistry;
  readonly app?: string;
  readonly expectedIssuer?: string;
  readonly header: Record<string, unknown> | undefined;
  readonly payload: Record<string, unknown>;
  readonly signaturePresent: boolean;
}

function formatExplain(input: FormatExplainInput): string {
  const { registry, app, expectedIssuer, header, payload, signaturePresent } = input;
  const lines: string[] = ['# Token explanation', ''];
  appendHeaderSection(lines, header);
  const { reservedClaims, customClaims } = partitionPayloadClaims(payload);
  appendReservedClaims(lines, reservedClaims);
  const warnings = collectExpiryWarnings(lines, payload);
  appendIssuerWarning(warnings, payload, expectedIssuer);
  const scopes = extractScopes(payload);
  appendScopesSection(lines, scopes, registry);
  appendCustomClaimsSection({ lines, customClaims, registry, app });
  appendWarningsSection(lines, warnings);
  if (signaturePresent) {
    appendSignaturePresentNote(lines);
  } else {
    appendSignatureMissingNote(lines);
  }
  return lines.join('\n');
}

function appendHeaderSection(lines: string[], header: Record<string, unknown> | undefined): void {
  if (header !== undefined) {
    lines.push('## Header', '', '```json', JSON.stringify(header, null, 2), '```', '');
  }
}

function partitionPayloadClaims(payload: Record<string, unknown>): { readonly reservedClaims: readonly { readonly key: string; readonly value: unknown }[]; readonly customClaims: readonly { readonly key: string; readonly value: unknown }[] } {
  const reservedClaims: { readonly key: string; readonly value: unknown }[] = [];
  const customClaims: { readonly key: string; readonly value: unknown }[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (RESERVED_JWT_CLAIMS.has(key)) {
      reservedClaims.push({ key, value });
    } else {
      customClaims.push({ key, value });
    }
  }
  return { reservedClaims, customClaims };
}

function appendReservedClaims(lines: string[], reservedClaims: readonly { readonly key: string; readonly value: unknown }[]): void {
  lines.push('## Reserved claims', '');
  if (reservedClaims.length === 0) {
    lines.push('_(none)_');
  } else {
    for (const { key, value } of reservedClaims) {
      lines.push(`- \`${key}\` = \`${formatClaimValue(value)}\` — ${describeReserved(key)}`);
    }
  }
}

function collectExpiryWarnings(lines: string[], payload: Record<string, unknown>): string[] {
  const warnings: string[] = [];
  const expValue = payload['exp'];
  if (typeof expValue === 'number') {
    const expiresAt = new Date(expValue * 1000);
    if (expiresAt.getTime() < Date.now()) {
      warnings.push(`Token is **expired** (exp = ${expiresAt.toISOString()}).`);
    } else {
      lines.push('', `Token expires at \`${expiresAt.toISOString()}\`.`);
    }
  }
  return warnings;
}

function appendIssuerWarning(warnings: string[], payload: Record<string, unknown>, expectedIssuer: string | undefined): void {
  const issValue = payload['iss'];
  if (expectedIssuer !== undefined && typeof issValue === 'string' && issValue !== expectedIssuer) {
    warnings.push(`Issuer mismatch — expected \`${expectedIssuer}\`, got \`${issValue}\`.`);
  }
}

function extractScopes(payload: Record<string, unknown>): string[] {
  const scopeValue = payload['scope'];
  let scopes: string[] = [];
  if (typeof scopeValue === 'string') {
    scopes = scopeValue.split(/\s+/).filter((s) => s.length > 0);
  } else if (Array.isArray(scopeValue)) {
    scopes = scopeValue.filter((s): s is string => typeof s === 'string');
  }
  return scopes;
}

function appendScopesSection(lines: string[], scopes: readonly string[], registry: AuthRegistry): void {
  if (scopes.length === 0) return;
  lines.push('', '## OIDC scopes', '');
  for (const scopeName of scopes) {
    const entry = registry.findScope(scopeName);
    if (entry === undefined) {
      lines.push(`- \`${scopeName}\` — _(not in catalog)_`);
    } else {
      lines.push(`- \`${scopeName}\` — ${entry.description}`);
    }
  }
}

interface AppendCustomClaimsSectionInput {
  readonly lines: string[];
  readonly customClaims: readonly { readonly key: string; readonly value: unknown }[];
  readonly registry: AuthRegistry;
  readonly app: string | undefined;
}

function appendCustomClaimsSection(input: AppendCustomClaimsSectionInput): void {
  const { lines, customClaims, registry, app } = input;
  lines.push('', '## Custom claims', '');
  if (customClaims.length === 0) {
    lines.push('_(none)_');
    return;
  }
  for (const { key, value } of customClaims) {
    const entry = registry.findClaim(key, app);
    if (entry === undefined) {
      lines.push(`- \`${key}\` = \`${formatClaimValue(value)}\` — _(not in catalog)_`);
    } else {
      lines.push(formatCustomClaim(key, value, entry));
    }
  }
}

function appendWarningsSection(lines: string[], warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  lines.push('', '## Warnings', '');
  for (const warning of warnings) {
    lines.push(`- :warning: ${warning}`);
  }
}

function appendSignaturePresentNote(lines: string[]): void {
  lines.push('', '_Signature present but **not** verified — this tool only decodes._');
}

function appendSignatureMissingNote(lines: string[]): void {
  lines.push('', '_Signature not verified — this tool only decodes._');
}

function formatCustomClaim(key: string, value: unknown, entry: AuthClaimInfo): string {
  const owner = entry.app ? ` (${entry.app})` : '';
  const arrow = entry.mapping.inverse ? 'revokes' : 'grants';
  const roles = entry.mapping.roles.map((r) => '`' + r + '`').join(', ') || '_(none)_';
  const lineRef = entry.sourceLine === undefined ? '' : `:${entry.sourceLine}`;
  return `- \`${key}\` = \`${formatClaimValue(value)}\`${owner} → \`${entry.interfaceName ?? '?'}\` ${arrow} ${roles}\n  ${entry.description} (\`${entry.sourcePath}${lineRef}\`)`;
}

function formatClaimValue(value: unknown): string {
  let result: string;
  if (typeof value === 'string') {
    result = value;
  } else if (value === null) {
    result = 'null';
  } else if (typeof value === 'object') {
    result = JSON.stringify(value);
  } else {
    result = String(value as number | boolean | bigint | symbol | undefined);
  }
  return result;
}

function describeReserved(key: string): string {
  const descriptions: Record<string, string> = {
    iss: 'Issuer.',
    sub: 'Subject (typically the user uid).',
    aud: 'Audience.',
    exp: 'Expiration time (UNIX seconds).',
    iat: 'Issued-at time (UNIX seconds).',
    nbf: 'Not-before time.',
    jti: 'JWT id.',
    scope: 'Space-separated OIDC scopes.',
    scp: 'OIDC scopes (array form).',
    azp: 'Authorized party (client id).',
    auth_time: 'When the user authenticated.',
    name: 'Display name.',
    email: 'User email.',
    email_verified: 'Email verification flag.',
    firebase: 'Firebase auth metadata block.'
  };
  return descriptions[key] ?? 'Reserved JWT claim.';
}
