import { type StorageFilePurpose, type StorageFilePurposeUploadPolicy } from '@dereekb/firebase';
import { type McpToolDetailsBuilder } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';

/**
 * Config for {@link storageFileCreateSignedUploadUrlToolDetailsFactory}.
 */
export interface StorageFileCreateSignedUploadUrlToolDetailsFactoryConfig {
  /**
   * The list of upload policies the app supports. Each policy's `purpose` is exposed in the
   * tool's input schema enum and described in the generated tool description.
   */
  readonly policies: readonly StorageFilePurposeUploadPolicy[];
}

/**
 * Builds the {@link McpToolDetailsBuilder} that customizes the MCP tool description and
 * input schema for the `storageFileCreateSignedUploadUrl` create-function.
 *
 * The factory captures the policy list once at wiring time; the returned builder is a pure
 * synchronous function called by the framework on every `tools/list` request.
 *
 * @example
 * ```ts
 * const toolDetails = storageFileCreateSignedUploadUrlToolDetailsFactory({
 *   policies: STORAGE_FILE_PURPOSE_UPLOAD_POLICIES
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function storageFileCreateSignedUploadUrlToolDetailsFactory(config: StorageFileCreateSignedUploadUrlToolDetailsFactoryConfig): McpToolDetailsBuilder {
  const { policies } = config;
  const purposeKeys: readonly StorageFilePurpose[] = policies.map((policy) => policy.purpose);
  const description = buildUploadPolicyPurposeDescription(policies);

  return ({ defaultInputSchema }) => ({
    description,
    inputSchema: enrichSignedUploadUrlInputSchema(defaultInputSchema, purposeKeys)
  });
}

function formatUploadPolicyMaxFileSize(maxFileSizeBytes: number): string {
  const mib = maxFileSizeBytes / (1024 * 1024);
  return Number.isInteger(mib) ? `${mib} MiB` : `${mib.toFixed(1)} MiB`;
}

function buildUploadPolicyPurposeDescription(policies: readonly StorageFilePurposeUploadPolicy[]): string {
  const lines = policies.map((policy) => {
    const filenameNote = policy.requiresFilenameInput ? 'filename required' : 'filename derived from uid';
    return `  - "${policy.purpose}": content-types ${policy.allowedMimeTypes.join(', ')}; max ${formatUploadPolicyMaxFileSize(policy.maxFileSizeBytes)}; ${filenameNote}`;
  });
  return `Issues a short-lived, content-type-pinned signed PUT URL for a StorageFile upload. The URL writes to "/uploads/u/{uid}/..." where the path, content-type, and size cap are pinned by the chosen purpose. PUT the bytes with a matching Content-Type header; the existing upload initializer then promotes the file to a StorageFile document.\n\nAllowed purposes:\n${lines.join('\n')}`;
}

function enrichSignedUploadUrlInputSchema(defaultInputSchema: Maybe<object>, purposeKeys: readonly StorageFilePurpose[]): object | undefined {
  let result: object | undefined = defaultInputSchema ?? undefined;

  if (defaultInputSchema != null && typeof defaultInputSchema === 'object') {
    const base = defaultInputSchema as { readonly properties?: Record<string, unknown> };
    const purposeProperty = base.properties?.purpose;

    if (purposeProperty != null && typeof purposeProperty === 'object') {
      const quotedPurposes = purposeKeys.map((purpose) => `"${purpose}"`).join(', ');
      result = {
        ...base,
        properties: {
          ...base.properties,
          purpose: {
            ...purposeProperty,
            enum: [...purposeKeys],
            description: `One of: ${quotedPurposes}.`
          }
        }
      };
    }
  }

  return result;
}
