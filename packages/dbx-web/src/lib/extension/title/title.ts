import { type Observable } from 'rxjs';
import { type Maybe } from '@dereekb/util';

/**
 * Config supplied by a single DbxWebPageTitleInfoDirective. Each segment contributes its own values to the hierarchical chain;
 * the active {@link DbxWebPageTitleDelegate} decides how segments combine into the final page title.
 *
 * @example
 * ```ts
 * const config: DbxWebPageTitleInfoConfig = { title: 'Inbox', description: 'Your messages' };
 * ```
 */
export interface DbxWebPageTitleInfoConfig {
  /**
   * Title segment for this level of the hierarchy.
   */
  readonly title?: Maybe<string>;
  /**
   * Optional meta description for this level of the hierarchy. The default delegate uses the leaf-most non-empty value.
   */
  readonly description?: Maybe<string>;
}

/**
 * Final, fully-resolved page title details emitted by the {@link DbxWebPageTitleDelegate}. Consumed by the service to update
 * the document title and exposed via {@link DbxWebPageTitleService#titleDetails$} for downstream consumers (e.g., meta tag setters).
 */
export interface DbxWebPageTitleDetails {
  readonly title: string;
  readonly description?: Maybe<string>;
}

/**
 * Reactive reference contributed by a directive registered with {@link DbxWebPageTitleService}.
 *
 * Each registered reference exposes:
 * - `chain$`: the composed config chain from the root ancestor down to this node, dropping null/undefined configs.
 * - `isLeaf$`: whether this reference currently has no registered descendants (i.e., it is a leaf candidate).
 *
 * The service picks the active leaf reference and feeds its chain into the delegate.
 */
export interface DbxWebPageTitleInfoReference {
  readonly chain$: Observable<readonly DbxWebPageTitleInfoConfig[]>;
  readonly isLeaf$: Observable<boolean>;
}
