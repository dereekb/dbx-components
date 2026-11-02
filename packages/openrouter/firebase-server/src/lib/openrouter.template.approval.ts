import { createHmac, timingSafeEqual } from 'node:crypto';
import { type ConfigService } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterModelConfig, type OpenRouterPromptKey, type OpenRouterPromptSeedMessage, type OpenRouterPromptVersionNumber, type OpenRouterResolvedPrompt, OpenRouterTemplateRenderError, type OpenRouterTemplateTypeKey } from '@dereekb/openrouter';

/**
 * Environment variable holding the server secret template approvals are signed with.
 */
export const OPENROUTER_TEMPLATE_APPROVAL_SECRET_ENV_VAR = 'OPENROUTER_TEMPLATE_APPROVAL_SECRET';

/**
 * The shortest approval secret accepted. A shorter one is treated as missing.
 */
export const OPENROUTER_TEMPLATE_APPROVAL_SECRET_MIN_LENGTH = 16;

/**
 * The server secret template approvals are signed with.
 */
export type OpenRouterTemplateApprovalSecret = string;

/**
 * A template approval: a hex HMAC-SHA256 over the canonical approval payload.
 */
export type OpenRouterTemplateApprovalHash = string;

/**
 * Everything a template approval covers. Changing any of it, including the type, invalidates the approval.
 */
export interface OpenRouterTemplateApprovalInput {
  readonly promptKey: OpenRouterPromptKey;
  readonly version: OpenRouterPromptVersionNumber;
  readonly templateType: OpenRouterTemplateTypeKey;
  readonly script?: Maybe<string>;
  readonly finalScript?: Maybe<string>;
  readonly instructions?: Maybe<string>;
  readonly messages?: Maybe<OpenRouterPromptSeedMessage[]>;
  readonly config?: Maybe<OpenRouterModelConfig>;
}

/**
 * Raised when an approval can't be signed or verified because the server has no approval secret.
 */
export class OpenRouterTemplateApprovalSecretMissingError extends OpenRouterTemplateRenderError {
  constructor() {
    super(`No template approval secret is configured (${OPENROUTER_TEMPLATE_APPROVAL_SECRET_ENV_VAR}), so stored template scripts can't be approved or run.`);
    this.name = 'OpenRouterTemplateApprovalSecretMissingError';
  }
}

/**
 * Serializes a JSON value with every object's keys sorted, so equal values always serialize to the same string.
 *
 * `undefined` object values are dropped, like `JSON.stringify` does, so an absent field and an undefined one sign the same.
 *
 * @param value - The JSON value.
 * @returns The canonical JSON string.
 */
export function canonicalOpenRouterTemplateJson(value: unknown): string {
  let result: string;

  if (value === null || typeof value !== 'object') {
    result = JSON.stringify(value) ?? 'null';
  } else if (Array.isArray(value)) {
    result = `[${value.map((x) => canonicalOpenRouterTemplateJson(x === undefined ? null : x)).join(',')}]`;
  } else {
    const entries = Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalOpenRouterTemplateJson((value as Record<string, unknown>)[key])}`);
    result = `{${entries.join(',')}}`;
  }

  return result;
}

function nonEmptyOpenRouterTemplateText(value: Maybe<string>): Maybe<string> {
  return value != null && value !== '' ? value : null;
}

/**
 * Builds the canonical payload an approval is signed over. An empty string and an absent value sign the same, since the
 * store may keep either.
 *
 * @param input - What the approval covers.
 * @returns The canonical JSON payload.
 */
export function openRouterTemplateApprovalPayload(input: OpenRouterTemplateApprovalInput): string {
  const { promptKey, version, templateType, script, finalScript, instructions, messages, config } = input;

  return canonicalOpenRouterTemplateJson({
    promptKey,
    version,
    templateType,
    script: nonEmptyOpenRouterTemplateText(script),
    finalScript: nonEmptyOpenRouterTemplateText(finalScript),
    instructions: nonEmptyOpenRouterTemplateText(instructions),
    messages: messages?.length ? messages.map(({ role, content }) => ({ role, content })) : null,
    config: config != null && Object.keys(config).length > 0 ? config : null
  });
}

/**
 * Reads what an approval covers from a resolved template version.
 *
 * @param resolved - The resolved version. Must carry its template half.
 * @returns The approval input.
 * @throws {OpenRouterTemplateRenderError} When the resolved prompt is not a template.
 */
export function openRouterTemplateApprovalInputForResolvedPrompt(resolved: OpenRouterResolvedPrompt): OpenRouterTemplateApprovalInput {
  const { promptKey, version, template, instructions, messages, config } = resolved;

  if (template == null) {
    throw new OpenRouterTemplateRenderError(`OpenRouter prompt "${promptKey}" is not a template.`);
  }

  return { promptKey, version, templateType: template.type, script: template.script, finalScript: template.finalScript, instructions, messages, config };
}

function assertOpenRouterTemplateApprovalSecret(secret: Maybe<OpenRouterTemplateApprovalSecret>): asserts secret is OpenRouterTemplateApprovalSecret {
  if (secret == null || secret.length < OPENROUTER_TEMPLATE_APPROVAL_SECRET_MIN_LENGTH) {
    throw new OpenRouterTemplateApprovalSecretMissingError();
  }
}

/**
 * Signs a template approval with the server secret.
 *
 * Keyed rather than a plain hash: anyone who can edit Firestore could recompute a plain hash after editing a script.
 *
 * @param secret - The approval secret. Signing fails closed when it is missing.
 * @param input - What the approval covers.
 * @returns The approval hash.
 */
export function signOpenRouterTemplateApproval(secret: Maybe<OpenRouterTemplateApprovalSecret>, input: OpenRouterTemplateApprovalInput): OpenRouterTemplateApprovalHash {
  assertOpenRouterTemplateApprovalSecret(secret);
  return createHmac('sha256', secret).update(openRouterTemplateApprovalPayload(input)).digest('hex');
}

/**
 * Checks a template approval against what the version says now, in constant time.
 *
 * @param secret - The approval secret. Verification fails closed (throws) when it is missing.
 * @param input - What the version says now.
 * @param hash - The stored approval hash.
 * @returns Whether the approval matches.
 */
export function verifyOpenRouterTemplateApproval(secret: Maybe<OpenRouterTemplateApprovalSecret>, input: OpenRouterTemplateApprovalInput, hash: Maybe<OpenRouterTemplateApprovalHash>): boolean {
  const expected = Buffer.from(signOpenRouterTemplateApproval(secret, input), 'hex');
  const actual = hash != null && /^[0-9a-f]{64}$/.test(hash) ? Buffer.from(hash, 'hex') : undefined;
  return actual?.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Reads the approval secret through the `ConfigService`.
 *
 * @param configService - The config service.
 * @param envVar - The variable to read. Defaults to {@link OPENROUTER_TEMPLATE_APPROVAL_SECRET_ENV_VAR}.
 * @returns The secret, or undefined when it is missing or too short, so approving and rendering stored scripts both fail closed.
 */
export function openRouterTemplateApprovalSecretFromConfigService(configService: ConfigService, envVar: string = OPENROUTER_TEMPLATE_APPROVAL_SECRET_ENV_VAR): Maybe<OpenRouterTemplateApprovalSecret> {
  const secret = configService.get<string>(envVar);
  return (secret?.length ?? 0) >= OPENROUTER_TEMPLATE_APPROVAL_SECRET_MIN_LENGTH ? secret : undefined;
}
