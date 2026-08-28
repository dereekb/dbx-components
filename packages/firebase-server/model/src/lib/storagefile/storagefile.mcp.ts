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
 * @param config - Factory config containing the upload policies that drive the description and `purpose` enum.
 * @returns A builder that emits the policy-aware tool description and an input schema with the `purpose` enum constrained to the configured purposes.
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
    const purposeProperty = base.properties?.['purpose'];

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

/**
 * Config for {@link storageFileProcessToolDetailsFactory}.
 */
export interface StorageFileProcessToolDetailsFactoryConfig {
  /**
   * App-specific guidance appended to the generated description.
   *
   * Use this to describe what processing means for the app's own purposes — for example which
   * purposes run a validation flow, and where that flow records its verdict.
   */
  readonly additionalGuidance?: Maybe<string>;
}

/**
 * Builds the {@link McpToolDetailsBuilder} that customizes the MCP tool description for the
 * `storageFileProcess` update-function.
 *
 * The generated description spells out which flag each processing state requires. The default
 * schema-derived description cannot convey that a file whose processor ran to completion sits in
 * the SUCCESS state even when the outcome was a rejection, so a caller re-validating a rejected
 * file would otherwise reach for the flagless call and get an "already processed" error.
 *
 * The factory captures the description once at wiring time; the returned builder is a pure
 * synchronous function called by the framework on every `tools/list` request.
 *
 * @param config - Optional factory config carrying app-specific guidance to append.
 * @returns A builder that emits the state-aware tool description and leaves the input schema at its default.
 *
 * @example
 * ```ts
 * const toolDetails = storageFileProcessToolDetailsFactory({
 *   additionalGuidance: 'The "resume" purpose records its verdict on the parent Profile.'
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function storageFileProcessToolDetailsFactory(config?: Maybe<StorageFileProcessToolDetailsFactoryConfig>): McpToolDetailsBuilder {
  const description = buildProcessStorageFileDescription(config?.additionalGuidance);
  return () => ({ description });
}

function buildProcessStorageFileDescription(additionalGuidance: Maybe<string>): string {
  const lines = [
    'Re-runs the processing/validation task for a single StorageFile.',
    '',
    'Processing runs as a NotificationTask. Which flag is required depends on the file\'s current processing state (the "ps" field):',
    '  - FAILED: no flag needed; processing restarts.',
    '  - SUCCESS: requires "processAgainIfSuccessful" (or "forceRestartProcessing"). A file whose processor ran to completion is SUCCESS even when the outcome was a rejection, so re-validating a rejected file normally needs this flag.',
    '  - PROCESSING: the in-flight task is only re-checked once it is more than 3 hours old. Pass "checkRetryProcessing" to check sooner, and "forceRestartProcessing" to abandon a live task and start over.',
    '  - INIT_OR_NONE / QUEUED_FOR_PROCESSING: processing begins.',
    '  - ARCHIVED / DO_NOT_PROCESS: cannot be processed; no flag overrides this.',
    '',
    'A restart replaces the file\'s processing task, clearing its completed checkpoints so the flow runs again from the start rather than resuming. The file must also be in the OK file state (the "fs" field); a file queued for delete is rejected.',
    '',
    'Set "runImmediately" to run the first step of the task inline instead of waiting for the scheduled task runner.'
  ];

  if (additionalGuidance) {
    lines.push('', additionalGuidance);
  }

  return lines.join('\n');
}
