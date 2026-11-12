import { type Maybe } from '@dereekb/util';
import { type UserExternalConnectionCapability } from './userexternalconnection.id';

// MARK: Scope Preset
/**
 * Key that identifies a {@link UserExternalConnectionScopePreset} within one provider, e.g. `read` or `readwrite`.
 *
 * Carried through the connect `state` and the `readAuthorizeState` callable, so keep it short.
 */
export type UserExternalConnectionScopePresetKey = string;

/**
 * A named set of scopes a user picks from when connecting a provider — "Read" or "Read + Write".
 *
 * A provider with presets is connected with exactly one of them: the chosen preset decides which
 * scopes the authorize request asks for, and the connection then records what the provider actually
 * granted. Switching presets is a reconnect.
 */
export interface UserExternalConnectionScopePreset {
  /**
   * Stable key for this preset, unique within the provider.
   */
  readonly key: UserExternalConnectionScopePresetKey;
  /**
   * Short human-readable label, e.g. `Read + Write`. Shown on the connect buttons and named in the
   * reconnect hint a mint returns when the connection lacks scopes.
   */
  readonly label: string;
  /**
   * Optional longer description of what the preset lets the app do.
   */
  readonly description?: Maybe<string>;
  /**
   * The provider scopes this preset requests.
   */
  readonly scopes: readonly UserExternalConnectionCapability[];
}

/**
 * Input for {@link userExternalConnectionScopePresetForCapabilities}.
 */
export interface UserExternalConnectionScopePresetForCapabilitiesInput {
  /**
   * The provider's presets.
   */
  readonly presets: Maybe<readonly UserExternalConnectionScopePreset[]>;
  /**
   * The capabilities the connection holds (an entry's `ca`).
   */
  readonly capabilities: Maybe<readonly UserExternalConnectionCapability[]>;
}

/**
 * Returns the largest preset whose scopes the connection's capabilities fully cover — the "current
 * access" a connected row shows.
 *
 * "Largest" is by scope count; on a tie the earlier preset wins. Returns undefined when no preset is
 * fully covered (or there are no presets / capabilities).
 *
 * @param input - The presets and the granted capabilities.
 * @returns The covered preset with the most scopes, if any.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function userExternalConnectionScopePresetForCapabilities(input: UserExternalConnectionScopePresetForCapabilitiesInput): Maybe<UserExternalConnectionScopePreset> {
  const { presets, capabilities } = input;
  let result: Maybe<UserExternalConnectionScopePreset>;

  if (presets?.length && capabilities?.length) {
    const granted = new Set(capabilities);

    for (const preset of presets) {
      if (preset.scopes.every((scope) => granted.has(scope)) && (!result || preset.scopes.length > result.scopes.length)) {
        result = preset;
      }
    }
  }

  return result;
}

/**
 * Input for {@link smallestUserExternalConnectionScopePresetCovering}.
 */
export interface SmallestUserExternalConnectionScopePresetCoveringInput {
  /**
   * The provider's presets.
   */
  readonly presets: Maybe<readonly UserExternalConnectionScopePreset[]>;
  /**
   * The scopes that must all be covered.
   */
  readonly scopes: readonly UserExternalConnectionCapability[];
}

/**
 * Returns the smallest preset whose scopes include every one of the given scopes — the preset a user
 * should reconnect with when a mint asks for scopes their connection was not granted.
 *
 * "Smallest" is by scope count; on a tie the earlier preset wins. Returns undefined when no preset
 * covers them all.
 *
 * @param input - The presets and the scopes to cover.
 * @returns The covering preset with the fewest scopes, if any.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function smallestUserExternalConnectionScopePresetCovering(input: SmallestUserExternalConnectionScopePresetCoveringInput): Maybe<UserExternalConnectionScopePreset> {
  const { presets, scopes } = input;
  let result: Maybe<UserExternalConnectionScopePreset>;

  if (presets?.length) {
    for (const preset of presets) {
      const presetScopes = new Set(preset.scopes);

      if (scopes.every((scope) => presetScopes.has(scope)) && (!result || preset.scopes.length < result.scopes.length)) {
        result = preset;
      }
    }
  }

  return result;
}

// MARK: Microsoft
/**
 * The Microsoft Graph delegated scopes the default "Read" preset requests, in their canonical casing.
 *
 * Plain strings rather than `@dereekb/microsoft` constants, so the server model and the Angular UI need
 * no dependency on the Microsoft package to declare or render the presets.
 */
export const MICROSOFT_GRAPH_READ_SCOPES: readonly UserExternalConnectionCapability[] = ['User.Read', 'Mail.Read', 'Calendars.Read', 'Files.Read.All', 'Sites.Read.All'];

/**
 * The Microsoft Graph delegated scopes the default "Read + Write" preset requests: the read set plus
 * the mail, calendar and files write scopes.
 *
 * Deliberately excludes `Mail.Send`.
 */
export const MICROSOFT_GRAPH_READ_WRITE_SCOPES: readonly UserExternalConnectionCapability[] = [...MICROSOFT_GRAPH_READ_SCOPES, 'Mail.ReadWrite', 'Calendars.ReadWrite', 'Files.ReadWrite.All'];

/**
 * Key of the default Microsoft "Read" preset.
 */
export const MICROSOFT_READ_SCOPE_PRESET_KEY: UserExternalConnectionScopePresetKey = 'read';

/**
 * Key of the default Microsoft "Read + Write" preset.
 */
export const MICROSOFT_READ_WRITE_SCOPE_PRESET_KEY: UserExternalConnectionScopePresetKey = 'readwrite';

/**
 * The default Microsoft "Read" preset.
 */
export const MICROSOFT_READ_SCOPE_PRESET: UserExternalConnectionScopePreset = {
  key: MICROSOFT_READ_SCOPE_PRESET_KEY,
  label: 'Read',
  description: 'Read your profile, mail, calendar and files.',
  scopes: MICROSOFT_GRAPH_READ_SCOPES
};

/**
 * The default Microsoft "Read + Write" preset.
 */
export const MICROSOFT_READ_WRITE_SCOPE_PRESET: UserExternalConnectionScopePreset = {
  key: MICROSOFT_READ_WRITE_SCOPE_PRESET_KEY,
  label: 'Read + Write',
  description: 'Read and change your mail, calendar and files. Never sends mail.',
  scopes: MICROSOFT_GRAPH_READ_WRITE_SCOPES
};

/**
 * The default scope presets a Microsoft connection is made with, smallest first.
 */
export const MICROSOFT_USER_EXTERNAL_CONNECTION_SCOPE_PRESETS: readonly UserExternalConnectionScopePreset[] = [MICROSOFT_READ_SCOPE_PRESET, MICROSOFT_READ_WRITE_SCOPE_PRESET];
