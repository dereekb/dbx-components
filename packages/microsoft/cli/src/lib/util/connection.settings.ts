import { CliError, type CliTokenSourceToken } from '@dereekb/dbx-cli';
import {
  MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE,
  type MicrosoftMailSignatureUserExternalConnectionData,
  type MicrosoftUserExternalConnectionDataTypes,
  type TypedUserExternalConnectionProviderData,
  microsoftMailSignatureItemKey,
  microsoftMailSignatureUserExternalConnectionDataValueType
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * The defaults msgraph-cli accepts from its token source: the Microsoft provider data shape, so the settings keys
 * are the data type keys (`mail_signature`), each holding items keyed by `me` or a lowercased sending address.
 *
 * An app CLI delivers them on the token bundle's `settings` when it minted with `?include=data` and its
 * `passthroughCliExternalConnectionDataAdapter` (or its own adapter) unpacked the user's stored connection data.
 */
export type MsGraphCliConnectionSettings = TypedUserExternalConnectionProviderData<MicrosoftUserExternalConnectionDataTypes>;

/**
 * Options for {@link msGraphCliConnectionSettingsFromToken}.
 */
export interface MsGraphCliConnectionSettingsFromTokenOptions {
  /**
   * Called with how many entries were dropped as invalid, when any were. Never receives the entries themselves.
   */
  readonly onInvalid?: Maybe<(count: number) => void>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reads the server defaults off a cached or freshly minted token: validates each `mail_signature` item with
 * {@link microsoftMailSignatureUserExternalConnectionDataValueType}, lowercases its key, and drops anything invalid
 * (an unknown key, a value that is not exactly one non-empty `html` / `text`).
 *
 * @param token - The token the source returned.
 * @param options - Called with the dropped-entry count.
 * @returns The settings, or undefined when the token carries no valid defaults.
 */
export function msGraphCliConnectionSettingsFromToken(token: Maybe<Pick<CliTokenSourceToken, 'settings'>>, options?: Maybe<MsGraphCliConnectionSettingsFromTokenOptions>): Maybe<MsGraphCliConnectionSettings> {
  const raw = token?.settings?.[MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE];
  let invalid = 0;
  let result: Maybe<MsGraphCliConnectionSettings>;

  if (isPlainRecord(raw)) {
    const signatures: Record<string, MicrosoftMailSignatureUserExternalConnectionData> = {};

    Object.entries(raw).forEach(([key, value]) => {
      const itemKey = microsoftMailSignatureItemKey(key);
      if (itemKey && microsoftMailSignatureUserExternalConnectionDataValueType.allows(value)) {
        signatures[itemKey] = value;
      } else {
        invalid += 1;
      }
    });

    if (Object.keys(signatures).length > 0) {
      result = { [MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE]: signatures };
    }
  } else if (raw != null) {
    invalid += 1;
  }

  if (invalid > 0) {
    options?.onInvalid?.(invalid);
  }

  return result;
}

/**
 * The token source a {@link msGraphCliServerSettingsGetter} reads.
 */
export interface MsGraphCliServerSettingsSource {
  readonly tokenSource: { loadToken(): Promise<Pick<CliTokenSourceToken, 'settings'>> };
}

/**
 * Options for {@link msGraphCliServerSettingsGetter}.
 */
export interface MsGraphCliServerSettingsGetterOptions {
  /**
   * In a dry run, a token-source failure omits the server defaults (and calls `onWarning`) instead of failing.
   */
  readonly dryRun?: Maybe<boolean>;
  /**
   * Called once with the failure's error code when a dry run degrades.
   */
  readonly onWarning?: Maybe<(code: string) => void>;
  /**
   * Called with how many invalid entries the token's settings carried.
   */
  readonly onInvalid?: Maybe<(count: number) => void>;
}

/**
 * Returns the warning a dry run adds when the server defaults could not be read.
 *
 * @param code - The token-source failure's error code.
 * @returns The warning line.
 */
export function msGraphCliServerDefaultsUnavailableWarning(code: string): string {
  return `server defaults unavailable (${code})`;
}

/**
 * Creates a lazy, memoized getter of the server defaults: the first call loads the token (cached, or minted by
 * the token command) and reads its settings. A command that never needs a signature never loads the token.
 *
 * Outside a dry run a load failure throws, as the Graph call would have. In a dry run it degrades: the getter
 * returns undefined and calls `onWarning` with the error code.
 *
 * @param context - Anything with the run's token source (the {@link MsGraphCliContext}).
 * @param options - Dry-run degrade and warning callbacks.
 * @returns The getter.
 */
export function msGraphCliServerSettingsGetter(context: MsGraphCliServerSettingsSource, options?: Maybe<MsGraphCliServerSettingsGetterOptions>): () => Promise<Maybe<MsGraphCliConnectionSettings>> {
  let loaded: Maybe<Promise<Maybe<MsGraphCliConnectionSettings>>>;

  async function load(): Promise<Maybe<MsGraphCliConnectionSettings>> {
    let result: Maybe<MsGraphCliConnectionSettings>;

    try {
      result = msGraphCliConnectionSettingsFromToken(await context.tokenSource.loadToken(), { onInvalid: options?.onInvalid });
    } catch (e) {
      if (!options?.dryRun) {
        throw e;
      }

      options.onWarning?.(e instanceof CliError ? e.code : 'TOKEN_SOURCE_FAILED');
    }

    return result;
  }

  return () => {
    loaded ??= load();
    return loaded;
  };
}

/**
 * The server defaults a write command reads its signature from, and the warnings a dry run collected.
 */
export interface MsGraphCliServerDefaults {
  /**
   * The lazy getter to pass as `readMsGraphCliSignature`'s `serverSettings`.
   */
  readonly serverSettings: () => Promise<Maybe<MsGraphCliConnectionSettings>>;
  /**
   * Filled by a dry run whose token source failed; pass to `msGraphCliDryRunOutput`.
   */
  readonly warnings: string[];
}

/**
 * Creates the server defaults for one write command run.
 *
 * @param argv - The parsed arguments (`dryRun`).
 * @param context - Anything with the run's token source.
 * @returns The getter and its warnings list.
 */
export function msGraphCliServerDefaults(argv: { readonly dryRun?: Maybe<boolean> }, context: MsGraphCliServerSettingsSource): MsGraphCliServerDefaults {
  const warnings: string[] = [];
  const serverSettings = msGraphCliServerSettingsGetter(context, { dryRun: argv.dryRun, onWarning: (code) => warnings.push(msGraphCliServerDefaultsUnavailableWarning(code)) });
  return { serverSettings, warnings };
}
