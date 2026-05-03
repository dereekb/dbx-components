import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BehaviorSubject, NEVER, type Observable, combineLatest, distinctUntilChanged, map, of, shareReplay, switchMap } from 'rxjs';
import { completeOnDestroy } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxWebPageTitleDelegate, dbxWebDefaultPageTitleDelegate } from './title.delegate';
import { type DbxWebPageTitleDetails, type DbxWebPageTitleInfoConfig, type DbxWebPageTitleInfoReference } from './title';

/**
 * Configuration for {@link DbxWebPageTitleService}, supplied via {@link DBX_WEB_PAGE_TITLE_SERVICE_CONFIG}.
 */
export interface DbxWebPageTitleServiceConfig {
  /**
   * Initial delegate to use. If omitted, the default {@link dbxWebDefaultPageTitleDelegate} is used.
   */
  readonly initialDelegate?: DbxWebPageTitleDelegate;
  /**
   * Initial value for `isTitleSyncEnabled$`. Defaults to true.
   */
  readonly initialTitleSyncEnabled?: boolean;
  /**
   * Default/root config that the service prepends to every chain handed to the delegate. Lets apps supply app-wide title/description metadata
   * without requiring a top-level `[dbxWebPageTitleInfo]` directive. Defaults to `{}` (no contribution).
   */
  readonly rootConfig?: DbxWebPageTitleInfoConfig;
}

/**
 * Injection token for {@link DbxWebPageTitleServiceConfig}.
 */
export const DBX_WEB_PAGE_TITLE_SERVICE_CONFIG = new InjectionToken<DbxWebPageTitleServiceConfig>('DBX_WEB_PAGE_TITLE_SERVICE_CONFIG');

/**
 * Tracks all {@link DbxWebPageTitleInfoReference} values registered by `[dbxWebPageTitleInfo]` directives, identifies the active leaf,
 * composes its hierarchical chain, and feeds the chain through a swappable {@link DbxWebPageTitleDelegate} to produce {@link DbxWebPageTitleDetails}.
 *
 * When `isTitleSyncEnabled$` is true, the service applies `titleDetails$.title` to the document via Angular's {@link Title} service.
 */
@Injectable()
export class DbxWebPageTitleService {
  private readonly _titleService = inject(Title);
  private readonly _config: DbxWebPageTitleServiceConfig = inject(DBX_WEB_PAGE_TITLE_SERVICE_CONFIG, { optional: true }) ?? {};

  private readonly _references = completeOnDestroy(new BehaviorSubject<Set<DbxWebPageTitleInfoReference>>(new Set()));
  private readonly _delegate = completeOnDestroy(new BehaviorSubject<DbxWebPageTitleDelegate>(this._config.initialDelegate ?? dbxWebDefaultPageTitleDelegate()));
  private readonly _isTitleSyncEnabled = completeOnDestroy(new BehaviorSubject<boolean>(this._config.initialTitleSyncEnabled ?? true));
  private readonly _rootConfig = completeOnDestroy(new BehaviorSubject<Maybe<DbxWebPageTitleInfoConfig>>(this._config.rootConfig));

  /**
   * Observable of all currently registered references.
   */
  readonly references$: Observable<ReadonlySet<DbxWebPageTitleInfoReference>> = this._references.asObservable();

  /**
   * Observable of the active delegate.
   */
  readonly delegate$: Observable<DbxWebPageTitleDelegate> = this._delegate.asObservable();

  /**
   * Whether the service applies `titleDetails$.title` to the document via {@link Title}.
   */
  readonly isTitleSyncEnabled$: Observable<boolean> = this._isTitleSyncEnabled.asObservable();

  /**
   * The default/root config supplied to the delegate alongside the directive chain. `undefined` when no root config is configured.
   */
  readonly rootConfig$: Observable<Maybe<DbxWebPageTitleInfoConfig>> = this._rootConfig.asObservable();

  /**
   * The active leaf reference: the most recently registered reference whose `isLeaf$` is currently true. Emits `undefined` when no leaves exist.
   */
  readonly leafReference$: Observable<Maybe<DbxWebPageTitleInfoReference>> = this._references.pipe(
    switchMap((set) => {
      const refs = [...set];
      if (refs.length === 0) return of<Maybe<DbxWebPageTitleInfoReference>>(undefined);
      return combineLatest(refs.map((ref) => ref.isLeaf$.pipe(map((isLeaf) => ({ ref, isLeaf }))))).pipe(
        map((items) =>
          items
            .filter((x) => x.isLeaf)
            .map((x) => x.ref)
            .at(-1)
        )
      );
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The directive-supplied chain (root → leaf) for the active leaf. Empty when there is no active leaf. Excludes the service-level rootConfig (delivered separately to the delegate).
   */
  readonly chain$: Observable<readonly DbxWebPageTitleInfoConfig[]> = this.leafReference$.pipe(
    switchMap((leaf) => leaf?.chain$ ?? of<readonly DbxWebPageTitleInfoConfig[]>([])),
    shareReplay(1)
  );

  /**
   * Final page title details produced by feeding `{ chain, rootConfig }` through the active delegate.
   */
  readonly titleDetails$: Observable<DbxWebPageTitleDetails> = combineLatest([this.chain$, this._rootConfig, this._delegate]).pipe(
    map(([chain, rootConfig, delegate]) => delegate.buildPageTitleDetails({ chain, rootConfig })),
    shareReplay(1)
  );

  constructor() {
    const sub = this._isTitleSyncEnabled.pipe(switchMap((enabled) => (enabled ? this.titleDetails$ : NEVER))).subscribe((details) => this._titleService.setTitle(details.title));

    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /**
   * Replaces the active delegate.
   *
   * @param delegate - The new delegate.
   */
  setDelegate(delegate: DbxWebPageTitleDelegate): void {
    this._delegate.next(delegate);
  }

  /**
   * Enables or disables auto-application of the computed title to the document.
   *
   * @param enabled - True to enable, false to disable.
   */
  setTitleSyncEnabled(enabled: boolean): void {
    this._isTitleSyncEnabled.next(enabled);
  }

  /**
   * Replaces (or clears, when `undefined`) the root/default config delivered to the delegate alongside the directive chain.
   *
   * @param config - The new root config, or `undefined` to clear it.
   */
  setRootConfig(config: Maybe<DbxWebPageTitleInfoConfig>): void {
    this._rootConfig.next(config);
  }

  /**
   * Registers a reference. Called by {@link DbxWebPageTitleInfoDirective} on construction.
   *
   * @param reference - The reference to register.
   */
  register(reference: DbxWebPageTitleInfoReference): void {
    const set = this._references.value;
    set.add(reference);
    this._references.next(set);
  }

  /**
   * Unregisters a reference. Called by {@link DbxWebPageTitleInfoDirective} on destroy.
   *
   * @param reference - The reference to unregister.
   */
  unregister(reference: DbxWebPageTitleInfoReference): void {
    const set = this._references.value;
    set.delete(reference);
    this._references.next(set);
  }
}
