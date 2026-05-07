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
        const decoded = token !== undefined ? decodeJwt(token) : { header: undefined, payload: claimsObj as Record<string, unknown>, signature: undefined };
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
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
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
  if (header !== undefined) {
    lines.push('## Header', '', '```json', JSON.stringify(header, null, 2), '```', '');
  }

  const reservedClaims: { readonly key: string; readonly value: unknown }[] = [];
  const customClaims: { readonly key: string; readonly value: unknown }[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (RESERVED_JWT_CLAIMS.has(key)) {
      reservedClaims.push({ key, value });
    } else {
      customClaims.push({ key, value });
    }
  }

  lines.push('## Reserved claims', '');
  if (reservedClaims.length === 0) {
    lines.push('_(none)_');
  } else {
    for (const { key, value } of reservedClaims) {
      lines.push(`- \`${key}\` = \`${formatClaimValue(value)}\` — ${describeReserved(key)}`);
    }
  }

  const warnings: string[] = [];
  const expValue = payload['exp'];
  if (typeof expValue === 'number') {
    const expiresAt = new Date(expValue * 1000);
    const now = Date.now();
    if (expiresAt.getTime() < now) {
      warnings.push(`Token is **expired** (exp = ${expiresAt.toISOString()}).`);
    } else {
      lines.push('', `Token expires at \`${expiresAt.toISOString()}\`.`);
    }
  }
  const issValue = payload['iss'];
  if (expectedIssuer !== undefined && typeof issValue === 'string' && issValue !== expectedIssuer) {
    warnings.push(`Issuer mismatch — expected \`${expectedIssuer}\`, got \`${issValue}\`.`);
  }
  const scopeValue = payload['scope'];
  let scopes: string[] = [];
  if (typeof scopeValue === 'string') {
    scopes = scopeValue.split(/\s+/).filter((s) => s.length > 0);
  } else if (Array.isArray(scopeValue)) {
    scopes = scopeValue.filter((s): s is string => typeof s === 'string');
  }

  if (scopes.length > 0) {
    lines.push('', '## OIDC scopes', '');
    for (const scopeName of scopes) {
      const entry = registry.findScope(scopeName);
      if (entry !== undefined) {
        lines.push(`- \`${scopeName}\` — ${entry.description}`);
      } else {
        lines.push(`- \`${scopeName}\` — _(not in catalog)_`);
      }
    }
  }

  lines.push('', '## Custom claims', '');
  if (customClaims.length === 0) {
    lines.push('_(none)_');
  } else {
    for (const { key, value } of customClaims) {
      const entry = registry.findClaim(key, app);
      if (entry !== undefined) {
        lines.push(formatCustomClaim(key, value, entry));
      } else {
        lines.push(`- \`${key}\` = \`${formatClaimValue(value)}\` — _(not in catalog)_`);
      }
    }
  }

  if (warnings.length > 0) {
    lines.push('', '## Warnings', '');
    for (const warning of warnings) {
      lines.push(`- :warning: ${warning}`);
    }
  }

  if (!signaturePresent) {
    lines.push('', '_Signature not verified — this tool only decodes._');
  } else {
    lines.push('', '_Signature present but **not** verified — this tool only decodes._');
  }
  return lines.join('\n');
}

function formatCustomClaim(key: string, value: unknown, entry: AuthClaimInfo): string {
  const owner = entry.app ? ` (${entry.app})` : '';
  const arrow = entry.mapping.inverse ? 'revokes' : 'grants';
  const roles = entry.mapping.roles.map((r) => '`' + r + '`').join(', ') || '_(none)_';
  const lineRef = entry.sourceLine !== undefined ? `:${entry.sourceLine}` : '';
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
    result = String(value);
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
