import { type UserExternalConnectionDataTypeConfig, type UserExternalConnectionDataTypeKey, type UserExternalConnectionProviderData, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type CliEnvConfig } from '../config/env';

/**
 * Settings a consuming CLI (e.g. `msgraph-cli`) applies as DEFAULTS, below its own config and flags.
 *
 * The shape is defined by the consumer. It must be plain JSON, because it rides the credential-process line and is
 * cached in the consumer's token-source entry.
 */
export type CliExternalConnectionSettings = Readonly<Record<string, unknown>>;

/**
 * Input to {@link CliExternalConnectionDataAdapter.unpack}.
 */
export interface CliExternalConnectionDataAdapterUnpackInput {
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The caller's stored data for the provider, as returned by the token API with `?include=data`.
   */
  readonly data: UserExternalConnectionProviderData;
  /**
   * The active env's config.
   */
  readonly env: CliEnvConfig;
}

/**
 * Input to {@link CliExternalConnectionDataAdapter.pack}.
 */
export interface CliExternalConnectionDataAdapterPackInput {
  readonly providerType: UserExternalConnectionProviderType;
  /**
   * The consumer CLI's settings, e.g. the output of `msgraph-cli config export`.
   */
  readonly settings: CliExternalConnectionSettings;
}

/**
 * Converts between an app's stored connection data and the settings a consuming CLI understands.
 *
 * Only the adapter's {@link unpack} output leaves the app CLI: raw stored data is never forwarded to the consumer.
 */
export interface CliExternalConnectionDataAdapter {
  /**
   * Converts stored data into the consumer CLI's settings.
   *
   * @param input - The provider, its stored data, and the env.
   * @returns The settings, or undefined when there are none.
   */
  unpack(input: CliExternalConnectionDataAdapterUnpackInput): Maybe<CliExternalConnectionSettings>;
  /**
   * Converts consumer settings into provider data to store (`connection-data import`).
   *
   * When absent, `connection-data import` is refused for the provider.
   *
   * @param input - The provider and the settings.
   * @returns The provider data.
   */
  pack?(input: CliExternalConnectionDataAdapterPackInput): UserExternalConnectionProviderData;
}

/**
 * Adapters keyed by provider type.
 */
export type CliExternalConnectionDataAdapters = Readonly<Record<UserExternalConnectionProviderType, CliExternalConnectionDataAdapter>>;

/**
 * The app CLI's connection-data config (`CreateCliInput.externalConnectionData`).
 */
export interface CliExternalConnectionDataConfig {
  /**
   * The app's data type registry: the same array the API module gets. Used to pack files, normalize item keys, and
   * describe data types in help text.
   */
  readonly dataTypes?: Maybe<readonly UserExternalConnectionDataTypeConfig[]>;
  /**
   * Adapters keyed by provider type. Only providers listed here request `?include=data` on `external-token`, so a
   * provider without an adapter never receives stored data.
   */
  readonly adapters: CliExternalConnectionDataAdapters;
}

/**
 * Input to {@link passthroughCliExternalConnectionDataAdapter}.
 */
export interface PassthroughCliExternalConnectionDataAdapterInput {
  /**
   * The data types to hand to the consumer. Any other stored data type is dropped.
   */
  readonly dataTypes: readonly UserExternalConnectionDataTypeKey[];
}

/**
 * Creates an adapter whose settings keys equal the data type keys.
 *
 * `unpack` picks the listed data types as they are stored; `pack` picks the same keys back out of the settings.
 * Non-object entries are dropped.
 *
 * @param input - The data types to pass through.
 * @returns The adapter.
 *
 * @example
 * ```typescript
 * const adapter = passthroughCliExternalConnectionDataAdapter({ dataTypes: [MICROSOFT_MAIL_SIGNATURE_USER_EXTERNAL_CONNECTION_DATA_TYPE] });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function passthroughCliExternalConnectionDataAdapter(input: PassthroughCliExternalConnectionDataAdapterInput): CliExternalConnectionDataAdapter {
  const { dataTypes } = input;

  function pick(source: Readonly<Record<string, unknown>>): Record<string, Record<string, Record<string, unknown>>> {
    const result: Record<string, Record<string, Record<string, unknown>>> = {};

    for (const dataType of dataTypes) {
      const items = plainObject(source[dataType]);

      if (items) {
        const picked: Record<string, Record<string, unknown>> = {};

        for (const [itemKey, value] of Object.entries(items)) {
          const item = plainObject(value);

          if (item) {
            picked[itemKey] = item;
          }
        }

        if (Object.keys(picked).length > 0) {
          result[dataType] = picked;
        }
      }
    }

    return result;
  }

  return {
    unpack: ({ data }) => {
      const settings = pick(data);
      return Object.keys(settings).length > 0 ? settings : undefined;
    },
    pack: ({ settings }) => pick(settings)
  };
}

/**
 * A keys-only description of settings: each settings key maps to its item keys, or `true` when its value is not an
 * object of items.
 */
export type CliExternalConnectionSettingsSummary = Record<string, string[] | true>;

/**
 * Summarizes settings for redacted output and reports, listing keys only and never values.
 *
 * @param settings - The settings.
 * @returns The summary, e.g. `{ mail_signature: ['me', 'support@example.com'] }`, or undefined when there are no settings.
 *
 * @example
 * ```typescript
 * summarizeCliExternalConnectionSettings({ mail_signature: { me: { html: '<p>Hi</p>' } } }); // { mail_signature: ['me'] }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function summarizeCliExternalConnectionSettings(settings: Maybe<CliExternalConnectionSettings>): Maybe<CliExternalConnectionSettingsSummary> {
  let result: Maybe<CliExternalConnectionSettingsSummary>;
  const keys = settings != null && typeof settings === 'object' ? Object.keys(settings) : [];

  if (keys.length > 0) {
    const summary: CliExternalConnectionSettingsSummary = {};

    for (const key of keys) {
      const items = plainObject((settings as CliExternalConnectionSettings)[key]);
      summary[key] = items ? Object.keys(items) : true;
    }

    result = summary;
  }

  return result;
}

// MARK: Internal
function plainObject(value: unknown): Maybe<Record<string, unknown>> {
  return value != null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
