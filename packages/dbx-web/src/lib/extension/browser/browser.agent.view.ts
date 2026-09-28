import { type Signal } from '@angular/core';
import { type BrowserAgentInfo, type BrowserAgentMatch, type BrowserAgentOsType, makeBrowserAgentMatchFunction } from '@dereekb/browser';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

// MARK: Entry
/**
 * Unique key of a {@link DbxBrowserAgentViewEntry} within a {@link DbxBrowserAgentViewConfig}.
 */
export type DbxBrowserAgentViewEntryKey = string;

/**
 * An entry displayed by the {@link DbxBrowserAgentViewComponent} when its match is the first to match the detected browser agent, or when it is selected manually.
 */
export interface DbxBrowserAgentViewEntry {
  /**
   * Unique key of the entry. Used to select the entry manually.
   */
  readonly key: DbxBrowserAgentViewEntryKey;
  /**
   * Label shown in the override menu.
   */
  readonly label: string;
  /**
   * Optional icon shown in the override menu.
   */
  readonly icon?: Maybe<string>;
  /**
   * Match used to auto-detect this entry.
   *
   * Entries without a match are never auto-detected, but can still be selected manually. Ignored on the default entry.
   */
  readonly match?: Maybe<BrowserAgentMatch>;
  /**
   * Component to render when this entry is selected.
   */
  readonly componentConfig: DbxInjectionComponentConfig;
}

/**
 * Config for a {@link DbxBrowserAgentViewComponent}.
 */
export interface DbxBrowserAgentViewConfig {
  /**
   * Ordered entries to match against. The first matching entry wins.
   */
  readonly entries?: Maybe<DbxBrowserAgentViewEntry[]>;
  /**
   * Entry used when no other entry matches.
   */
  readonly defaultEntry: DbxBrowserAgentViewEntry;
  /**
   * Whether or not to show the override button that lets the user pick another entry.
   */
  readonly showOverrideButton?: Maybe<boolean>;
}

/**
 * Returns the first entry of the config whose match matches the input browser agent info, otherwise the config's default entry.
 *
 * @param config - The view config to search.
 * @param agentInfo - The browser agent info to match against.
 * @returns The matching entry, or the default entry.
 *
 * @example
 * ```typescript
 * const entry = findDbxBrowserAgentViewEntry(config, getCurrentBrowserAgentInfo());
 * ```
 */
export function findDbxBrowserAgentViewEntry(config: DbxBrowserAgentViewConfig, agentInfo: BrowserAgentInfo): DbxBrowserAgentViewEntry {
  const matchingEntry = (config.entries ?? []).find((entry) => entry.match != null && makeBrowserAgentMatchFunction(entry.match)(agentInfo));
  return matchingEntry ?? config.defaultEntry;
}

// MARK: Context
/**
 * Context provided by the {@link DbxBrowserAgentViewComponent}.
 *
 * Injected components can inject this to read the detected browser agent or to switch to another entry.
 */
export abstract class DbxBrowserAgentViewContext {
  /**
   * The detected browser agent info.
   */
  abstract readonly agentInfo: BrowserAgentInfo;
  /**
   * All entries of the config, including the default entry as the last entry.
   */
  abstract readonly entriesSignal: Signal<DbxBrowserAgentViewEntry[]>;
  /**
   * The entry that matches the detected browser agent.
   */
  abstract readonly detectedEntrySignal: Signal<Maybe<DbxBrowserAgentViewEntry>>;
  /**
   * The entry currently displayed. This is the override entry when set, otherwise the detected entry.
   */
  abstract readonly selectedEntrySignal: Signal<Maybe<DbxBrowserAgentViewEntry>>;
  /**
   * Whether or not an override entry is currently selected.
   */
  abstract readonly isOverriddenSignal: Signal<boolean>;
  /**
   * Selects the entry with the input key. Unknown keys fall back to the detected entry.
   */
  abstract setOverride(key: Maybe<DbxBrowserAgentViewEntryKey>): void;
  /**
   * Clears the override and returns to the detected entry.
   */
  abstract clearOverride(): void;
}

// MARK: OS
/**
 * An operating system that can be configured with {@link makeDbxBrowserAgentViewConfigFromOsMap}, or `default` for the default entry.
 */
export type DbxBrowserAgentViewOsKey = Exclude<BrowserAgentOsType, 'unknown'> | 'default';

/**
 * Display label and icon for an OS entry.
 */
export interface DbxBrowserAgentViewOsDisplay {
  readonly label: string;
  readonly icon: string;
}

/**
 * Default labels and icons for each {@link DbxBrowserAgentViewOsKey}.
 */
export const DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY: Readonly<Record<DbxBrowserAgentViewOsKey, DbxBrowserAgentViewOsDisplay>> = {
  ios: { label: 'iPhone / iPad', icon: 'phone_iphone' },
  android: { label: 'Android', icon: 'android' },
  windows: { label: 'Windows', icon: 'desktop_windows' },
  macos: { label: 'Mac', icon: 'laptop_mac' },
  linux: { label: 'Linux', icon: 'computer' },
  chromeos: { label: 'ChromeOS', icon: 'laptop_chromebook' },
  default: { label: 'Other', icon: 'devices' }
};

/**
 * Order the OS entries are created in by {@link makeDbxBrowserAgentViewConfigFromOsMap}.
 */
const DBX_BROWSER_AGENT_VIEW_OS_MAP_ORDER: readonly Exclude<DbxBrowserAgentViewOsKey, 'default'>[] = ['ios', 'android', 'windows', 'macos', 'linux', 'chromeos'];

/**
 * Component config for an OS entry, with an optional custom label and icon.
 */
export interface DbxBrowserAgentViewOsEntryConfig {
  readonly componentConfig: DbxInjectionComponentConfig;
  /**
   * Custom label. Defaults to the {@link DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY} label.
   */
  readonly label?: Maybe<string>;
  /**
   * Custom icon. Defaults to the {@link DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY} icon.
   */
  readonly icon?: Maybe<string>;
}

/**
 * A component config, or a {@link DbxBrowserAgentViewOsEntryConfig} to customize the display.
 */
export type DbxBrowserAgentViewOsMapValue = DbxInjectionComponentConfig | DbxBrowserAgentViewOsEntryConfig;

/**
 * Creates a {@link DbxBrowserAgentViewEntry} for the input OS, using the default label and icon and matching on the OS.
 *
 * The `default` key creates an entry without a match.
 *
 * @param os - The OS to create the entry for.
 * @param componentConfigOrEntry - The component config, or an entry config with a custom label and icon.
 * @returns The entry.
 *
 * @example
 * ```typescript
 * const iosEntry = makeDbxBrowserAgentViewEntryForOs('ios', { componentClass: IosInstructionsComponent });
 * const androidEntry = makeDbxBrowserAgentViewEntryForOs('android', { componentConfig: { componentClass: AndroidInstructionsComponent }, label: 'Android Phone' });
 * ```
 */
export function makeDbxBrowserAgentViewEntryForOs(os: DbxBrowserAgentViewOsKey, componentConfigOrEntry: DbxBrowserAgentViewOsMapValue): DbxBrowserAgentViewEntry {
  const display = DEFAULT_DBX_BROWSER_AGENT_VIEW_OS_DISPLAY[os];
  const entryConfig: DbxBrowserAgentViewOsEntryConfig = 'componentConfig' in componentConfigOrEntry ? componentConfigOrEntry : { componentConfig: componentConfigOrEntry };

  return {
    key: os,
    label: entryConfig.label ?? display.label,
    icon: entryConfig.icon ?? display.icon,
    match: os === 'default' ? undefined : { os },
    componentConfig: entryConfig.componentConfig
  };
}

/**
 * Input for {@link makeDbxBrowserAgentViewConfigFromOsMap}.
 */
export interface DbxBrowserAgentViewOsMapConfig {
  readonly ios?: Maybe<DbxBrowserAgentViewOsMapValue>;
  readonly android?: Maybe<DbxBrowserAgentViewOsMapValue>;
  readonly windows?: Maybe<DbxBrowserAgentViewOsMapValue>;
  readonly macos?: Maybe<DbxBrowserAgentViewOsMapValue>;
  readonly linux?: Maybe<DbxBrowserAgentViewOsMapValue>;
  readonly chromeos?: Maybe<DbxBrowserAgentViewOsMapValue>;
  /**
   * Used when the detected OS has no entry.
   */
  readonly default: DbxBrowserAgentViewOsMapValue;
  readonly showOverrideButton?: Maybe<boolean>;
}

/**
 * Creates a {@link DbxBrowserAgentViewConfig} with one entry per configured OS, plus the default entry.
 *
 * @param config - The component config for each OS.
 * @returns The view config.
 *
 * @example
 * ```typescript
 * const config = makeDbxBrowserAgentViewConfigFromOsMap({
 *   ios: { componentClass: IosInstructionsComponent },
 *   android: { componentClass: AndroidInstructionsComponent },
 *   default: { componentClass: BookmarkInstructionsComponent },
 *   showOverrideButton: true
 * });
 * ```
 */
export function makeDbxBrowserAgentViewConfigFromOsMap(config: DbxBrowserAgentViewOsMapConfig): DbxBrowserAgentViewConfig {
  const entries: DbxBrowserAgentViewEntry[] = [];

  DBX_BROWSER_AGENT_VIEW_OS_MAP_ORDER.forEach((os) => {
    const value = config[os];

    if (value != null) {
      entries.push(makeDbxBrowserAgentViewEntryForOs(os, value));
    }
  });

  return {
    entries,
    defaultEntry: makeDbxBrowserAgentViewEntryForOs('default', config.default),
    showOverrideButton: config.showOverrideButton
  };
}
