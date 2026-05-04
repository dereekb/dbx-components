import { DestroyRef, Directive, inject, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject, type Observable, combineLatest, map, of, shareReplay } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type DbxWebPageTitleInfoConfig, type DbxWebPageTitleInfoReference } from './title';
import { DbxWebPageTitleService } from './title.service';
import { completeOnDestroy } from '@dereekb/dbx-core';

/**
 * Registers a hierarchical page title segment with {@link DbxWebPageTitleService}. Multiple directives nested in the host tree
 * form a chain (root → leaf); the leaf's segment takes priority through the active delegate.
 *
 * The directive locates its parent of the same type via element-injector ascent (`{ skipSelf: true, optional: true }`),
 * mirroring Angular CDK's tree-node hierarchy pattern. Each directive maintains its own `children` set so the service can
 * compute which directives are leaves at any moment.
 *
 * Requires {@link provideDbxWebPageTitleService} to be set up at the application or feature scope.
 *
 * @dbxWebComponent
 * @dbxWebSlug page-title-info
 * @dbxWebCategory navigation
 * @dbxWebSkillRefs dbx__ref__dbx-app-structure
 * @dbxWebMinimalExample ```html
 * <div [dbxWebPageTitleInfo]="{ title: 'Docs' }"></div>
 * ```
 *
 * @example
 * ```html
 * <div [dbxWebPageTitleInfo]="appTitleConfigSignal()">
 *   <ui-view>
 *     <div [dbxWebPageTitleInfo]="pageTitleConfigSignal()">
 *       <!-- leaf -->
 *     </div>
 *   </ui-view>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxWebPageTitleInfo]',
  standalone: true,
  exportAs: 'dbxWebPageTitleInfo'
})
export class DbxWebPageTitleInfoDirective implements DbxWebPageTitleInfoReference {
  private readonly _service = inject(DbxWebPageTitleService);
  private readonly _parent = inject(DbxWebPageTitleInfoDirective, { skipSelf: true, optional: true });
  private readonly _destroyRef = inject(DestroyRef);

  readonly dbxWebPageTitleInfo = input<Maybe<DbxWebPageTitleInfoConfig>>();

  private readonly _children = completeOnDestroy(new BehaviorSubject<Set<DbxWebPageTitleInfoDirective>>(new Set()));

  readonly config$: Observable<Maybe<DbxWebPageTitleInfoConfig>> = toObservable(this.dbxWebPageTitleInfo);

  readonly chain$: Observable<readonly DbxWebPageTitleInfoConfig[]> = combineLatest([this._parent?.chain$ ?? of<readonly DbxWebPageTitleInfoConfig[]>([]), this.config$]).pipe(
    map(([parentChain, config]) => (config ? [...parentChain, config] : parentChain)),
    shareReplay(1)
  );

  readonly isLeaf$: Observable<boolean> = this._children.pipe(
    map((c) => c.size === 0),
    shareReplay(1)
  );

  constructor() {
    this._service.register(this);

    if (this._parent) {
      this._parent._addChild(this);
    }

    this._destroyRef.onDestroy(() => {
      this._service.unregister(this);
      this._parent?._removeChild(this);
      this._children.complete();
    });
  }

  /**
   * @internal Maintained by descendant directives to keep `isLeaf$` accurate.
   *
   * @param child - The descendant directive to register as a child.
   */
  _addChild(child: DbxWebPageTitleInfoDirective): void {
    const next = new Set(this._children.value);
    next.add(child);
    this._children.next(next);
  }

  /**
   * @internal
   *
   * @param child - The descendant directive to unregister.
   */
  _removeChild(child: DbxWebPageTitleInfoDirective): void {
    const next = new Set(this._children.value);
    next.delete(child);
    this._children.next(next);
  }
}
