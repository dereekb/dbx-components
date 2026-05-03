import { type Maybe } from '@dereekb/util';
import { type DbxWebPageTitleDetails, type DbxWebPageTitleInfoConfig } from './title';

/**
 * Input handed to {@link DbxWebPageTitleDelegate#buildPageTitleDetails}.
 *
 * The directive {@link chain} (root → leaf) and the service-level {@link rootConfig} are kept separate so a delegate can apply different rules
 * to the app-wide root config than to the directive-supplied chain (e.g., always render the root config last regardless of leaf order, or skip it entirely).
 */
export interface DbxWebPageTitleDelegateInput {
  /**
   * Hierarchical chain supplied by `[dbxWebPageTitleInfo]` directives, ordered root → leaf. Excludes the service-level root config.
   */
  readonly chain: readonly DbxWebPageTitleInfoConfig[];
  /**
   * Service-level root config, if one was provided via {@link DbxWebPageTitleServiceConfig#rootConfig}. `undefined` when no root config is set.
   */
  readonly rootConfig?: Maybe<DbxWebPageTitleInfoConfig>;
}

/**
 * Combines the directive chain plus the optional service-level root config into the final {@link DbxWebPageTitleDetails}.
 * Apps may swap in a custom delegate via {@link DbxWebPageTitleService#setDelegate}.
 */
export interface DbxWebPageTitleDelegate {
  buildPageTitleDetails(input: DbxWebPageTitleDelegateInput): DbxWebPageTitleDetails;
}

/**
 * Configuration for {@link dbxWebDefaultPageTitleDelegate}.
 */
export interface DbxWebDefaultPageTitleDelegateConfig {
  /**
   * Final fallback title used when the combined chain produces no non-empty title segments. Defaults to ''.
   */
  readonly defaultTitle?: string;
  /**
   * Separator between non-empty title segments. Defaults to ' | '.
   */
  readonly separator?: string;
  /**
   * If true, segments are joined leaf-first (e.g. 'Page | Section | App').
   * If false, root-first (e.g. 'App | Section | Page'). Defaults to true.
   */
  readonly leafFirst?: boolean;
  /**
   * If set, appended to the final title using the same separator (e.g. ' | MyApp'). Useful when neither the chain nor the rootConfig carries an app-name segment.
   */
  readonly appNameSuffix?: Maybe<string>;
}

/**
 * Builds a {@link DbxWebPageTitleDelegate} that prepends the optional rootConfig to the directive chain, then joins non-empty title segments with a separator.
 *
 * - Title: rootConfig (if set) sits at the root; the chain extends from there toward the leaf. Non-empty `title` values are joined using `separator`,
 *   leaf-first by default. When the combined chain has no non-empty segments, `defaultTitle` is used. When `appNameSuffix` is set, it is appended with the same separator.
 * - Description: the leaf-most non-empty `description` across the combined chain wins. Falls back to `undefined` if no segment provides one.
 *
 * @param config - Delegate configuration.
 * @returns A configured {@link DbxWebPageTitleDelegate}.
 *
 * @example
 * ```ts
 * const delegate = dbxWebDefaultPageTitleDelegate({ separator: ' · ' });
 * delegate.buildPageTitleDetails({ chain: [{ title: 'Inbox' }], rootConfig: { title: 'MyApp' } }); // { title: 'Inbox · MyApp' }
 * ```
 */
export function dbxWebDefaultPageTitleDelegate(config: DbxWebDefaultPageTitleDelegateConfig = {}): DbxWebPageTitleDelegate {
  const { defaultTitle = '', separator = ' | ', leafFirst = true, appNameSuffix } = config;

  return {
    buildPageTitleDetails({ chain, rootConfig }) {
      const fullChain: readonly DbxWebPageTitleInfoConfig[] = rootConfig ? [rootConfig, ...chain] : chain;

      const segments: string[] = [];
      for (const item of fullChain) {
        const t = item.title?.trim();
        if (t) segments.push(t);
      }

      const ordered = leafFirst ? [...segments].reverse() : segments;
      let title = ordered.length > 0 ? ordered.join(separator) : defaultTitle;
      if (appNameSuffix) {
        title = `${title}${separator}${appNameSuffix}`;
      }

      let description: Maybe<string>;
      for (let i = fullChain.length - 1; i >= 0; i -= 1) {
        const d = fullChain[i].description;
        if (d) {
          description = d;
          break;
        }
      }

      return { title, description };
    }
  };
}
