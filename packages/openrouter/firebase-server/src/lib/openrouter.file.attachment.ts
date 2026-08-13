import { type FirebaseStorageContext, type StoragePath } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe, type Milliseconds, MS_IN_MINUTE } from '@dereekb/util';
import { type OpenRouterAttachedFileReference, type OpenRouterFileReference } from '@dereekb/openrouter';

/**
 * How a file is carried to OpenRouter on one attempt.
 *
 * - `signedUrl` — a short-lived signed url OpenRouter dereferences itself. Cheap, and the default.
 * - `inlineData` — the bytes, base64'd into the request body. The only option when the object is not
 *   reachable from the public internet, which is exactly the case against the Firebase storage
 *   emulator: signing is unsupported there, so the accessor falls back to a `publicUrl()` on localhost.
 */
export type OpenRouterFileAttachmentMode = 'signedUrl' | 'inlineData';

/**
 * Default lifetime of a signed url minted for one attempt.
 *
 * Deliberately short. The url only has to survive the single request it is attached to, and every
 * attempt gets a freshly signed one — so a short TTL costs nothing and narrows the window in which a
 * third party holds a bearer credential to the object.
 */
export const DEFAULT_OPENROUTER_SIGNED_URL_TTL: Milliseconds = MS_IN_MINUTE * 5;

/**
 * Cap on the size of a file carried inline.
 *
 * Base64 inflates the payload by roughly a third, and the cost is re-paid on EVERY attempt rather than
 * amortized the way a url is — so this is a guard against turning a retry loop into a bandwidth bill,
 * not a correctness limit.
 */
export const DEFAULT_OPENROUTER_MAX_INLINE_FILE_SIZE_BYTES = 256 * 1024;

/**
 * Content type assumed for an inlined object whose metadata reports none.
 *
 * Matches {@link openRouterInputFileDataPart}'s own default, so the two cannot disagree.
 */
export const DEFAULT_OPENROUTER_INLINE_FILE_CONTENT_TYPE = 'application/pdf';

/**
 * Config for {@link openRouterFileAttachmentResolver}.
 */
export interface OpenRouterFileAttachmentResolverConfig {
  /**
   * Storage context the files are read from. Required only when files are actually attached.
   */
  readonly storageContext?: Maybe<FirebaseStorageContext>;
  /**
   * Selects the mode when `mode` is not given: a non-production environment picks `inlineData`.
   *
   * This is the whole environment gate. An app wires its env service in once and both the emulator and
   * production do the right thing without a second switch to keep in sync.
   */
  readonly envService?: Maybe<FirebaseServerEnvService>;
  /**
   * Explicit mode override. Wins over `envService`.
   *
   * For a unit test that wants one specific transport, or an app that knows its objects are (or are
   * not) publicly reachable regardless of environment.
   */
  readonly mode?: Maybe<OpenRouterFileAttachmentMode>;
  /**
   * Signed-url lifetime. Defaults to {@link DEFAULT_OPENROUTER_SIGNED_URL_TTL}.
   */
  readonly signedUrlTtl?: Maybe<Milliseconds>;
  /**
   * Inline size cap. Defaults to {@link DEFAULT_OPENROUTER_MAX_INLINE_FILE_SIZE_BYTES}.
   */
  readonly maxInlineFileSizeBytes?: Maybe<number>;
}

/**
 * Resolves file references into the attachments to send on ONE attempt.
 */
export type OpenRouterFileAttachmentResolver = (files: Maybe<OpenRouterFileReference[]>) => Promise<OpenRouterAttachedFileReference[]>;

/**
 * The mode a config resolves to.
 *
 * Order: the explicit override, then the environment service, then `signedUrl`.
 *
 * Gated on `isProduction` rather than `isTestingEnv`, because the question is whether OpenRouter can
 * reach the object, not whether this is a test. Every non-production environment here is a localhost
 * one — the emulator under `nx serve` as much as a spec run — and `isTestingEnv` is only
 * `NODE_ENV === 'test'`, so it covered the spec run and left the emulator handing OpenRouter a
 * `127.0.0.1` url that it rejects outright.
 *
 * @param config - The resolver config.
 * @returns The mode.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterFileAttachmentModeForConfig(config: OpenRouterFileAttachmentResolverConfig): OpenRouterFileAttachmentMode {
  const { mode, envService } = config;
  // `=== false` rather than a negation, so a config with no env service still resolves to `signedUrl`.
  return mode ?? (envService?.isProduction === false ? 'inlineData' : 'signedUrl');
}

/**
 * Creates an {@link OpenRouterFileAttachmentResolver}.
 *
 * Called once per attempt, never at enqueue time: both transports produce something that is only valid
 * for the request it is attached to.
 *
 * @param config - The storage context, environment service, and transport settings.
 * @returns The resolver.
 */
export function openRouterFileAttachmentResolver(config: OpenRouterFileAttachmentResolverConfig): OpenRouterFileAttachmentResolver {
  const { storageContext, signedUrlTtl, maxInlineFileSizeBytes } = config;

  const mode = openRouterFileAttachmentModeForConfig(config);
  const urlTtl = signedUrlTtl ?? DEFAULT_OPENROUTER_SIGNED_URL_TTL;
  const maxInlineBytes = maxInlineFileSizeBytes ?? DEFAULT_OPENROUTER_MAX_INLINE_FILE_SIZE_BYTES;

  return async function resolveAttachments(files: Maybe<OpenRouterFileReference[]>): Promise<OpenRouterAttachedFileReference[]> {
    let result: OpenRouterAttachedFileReference[] = [];

    if (files != null && files.length > 0) {
      if (storageContext == null) {
        throw new Error('An OpenRouterRunTask carries files but no storageContext was configured to attach them with.');
      }

      const defaultBucketId = storageContext.defaultBucket();

      result = await Promise.all(
        files.map(async (file) => {
          const path: StoragePath = { bucketId: file.bucket ?? defaultBucketId, pathString: file.storagePath };
          const accessorFile = storageContext.file(path);
          let attached: OpenRouterAttachedFileReference;

          if (mode === 'inlineData') {
            if (accessorFile.getBytes == null) {
              throw new Error('The configured FirebaseStorageContext cannot read file bytes, which inline file attachment requires.');
            }

            // The cap is handed to the accessor rather than checked after the fact: that is what stops an
            // oversized object being pulled into memory at all.
            const bytes = await accessorFile.getBytes(maxInlineBytes);
            const metadata = await accessorFile.getMetadata();
            const contentType = metadata.contentType ?? DEFAULT_OPENROUTER_INLINE_FILE_CONTENT_TYPE;

            attached = { file, fileData: `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}` };
          } else {
            if (accessorFile.getSignedUrl == null) {
              throw new Error('The configured FirebaseStorageContext cannot mint signed urls.');
            }

            attached = { file, fileUrl: await accessorFile.getSignedUrl({ action: 'read', expiresIn: urlTtl }) };
          }

          return attached;
        })
      );
    }

    return result;
  };
}
