import { computed, DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';
import { type DestroyFunction, type Maybe } from '@dereekb/util';

/**
 * Which box of a source element is measured.
 *
 * - border-box: the element's full height, including padding and border (the default).
 * - content-box: the height inside the padding. Use it when the element's padding is spacing around the visible part, such as the vertical
 *   padding dbx puts on mat-form-field.
 */
export type DbxHeightSyncSourceBox = 'border-box' | 'content-box';

/**
 * Registration of a height sync source, returned by {@link DbxHeightSyncDirective.registerSource}.
 */
export interface DbxHeightSyncSourceRegistration {
  /**
   * Reports the source's current height, in pixels.
   */
  readonly setHeight: (height: number) => void;
  /**
   * Removes the source from the group.
   */
  readonly destroy: DestroyFunction;
}

/**
 * Groups elements whose heights are kept in sync. Elements marked with {@link DbxHeightSyncSourceDirective} are measured, and elements marked
 * with {@link DbxHeightSyncFollowerDirective} take the tallest source's height. Followers are never measured, so there is no feedback loop.
 *
 * Sources and followers find the group through dependency injection, so they can sit inside child components or projected content.
 *
 * @dbxWebComponent
 * @dbxWebSlug height-sync
 * @dbxWebCategory layout
 * @dbxWebRelated height-sync-source, height-sync-follower, flex-group
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxHeightSync><textarea dbxHeightSyncSource></textarea><button dbxHeightSyncFollower>Run</button></div>
 * ```
 *
 * @example
 * ```html
 * <div class="dbx-flex" dbxHeightSync>
 *   <mat-form-field dbxHeightSyncSource>...</mat-form-field>
 *   <dbx-button dbxHeightSyncFollower text="Run"></dbx-button>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxHeightSync]',
  exportAs: 'dbxHeightSync',
  standalone: true
})
export class DbxHeightSyncDirective {
  private _nextSourceId = 0;
  private readonly _sourceHeights = signal<ReadonlyMap<number, number>>(new Map());

  /**
   * The height followers take: the tallest source's height in pixels, or undefined until a source is measured.
   */
  readonly heightSignal = computed<Maybe<number>>(() => {
    const heights = Array.from(this._sourceHeights().values());
    return heights.length ? Math.max(...heights) : undefined;
  });

  /**
   * Registers a source. Used by {@link DbxHeightSyncSourceDirective}.
   *
   * @returns The registration.
   */
  registerSource(): DbxHeightSyncSourceRegistration {
    const id = (this._nextSourceId += 1);

    return {
      setHeight: (height: number) => {
        if (this._sourceHeights().get(id) !== height) {
          this._sourceHeights.update((x) => new Map(x).set(id, height));
        }
      },
      destroy: () => {
        this._sourceHeights.update((x) => {
          const next = new Map(x);
          next.delete(id);
          return next;
        });
      }
    };
  }
}

/**
 * Marks an element whose height drives the followers of the nearest {@link DbxHeightSyncDirective}. Measures its height with a ResizeObserver:
 * the border box by default, or the content box with `dbxHeightSyncSource="content-box"`. Does nothing without a group.
 *
 * @dbxWebComponent
 * @dbxWebSlug height-sync-source
 * @dbxWebCategory layout
 * @dbxWebRelated height-sync, height-sync-follower
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxHeightSync><div dbxHeightSyncSource>Measured</div></div>
 * ```
 *
 * @example
 * ```html
 * <mat-form-field dbxHeightSyncSource="content-box">...</mat-form-field>
 * ```
 */
@Directive({
  selector: '[dbxHeightSyncSource]',
  standalone: true
})
export class DbxHeightSyncSourceDirective {
  readonly group = inject(DbxHeightSyncDirective, { optional: true });
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Which box to measure. Defaults to the border box.
   */
  readonly dbxHeightSyncSource = input<Maybe<DbxHeightSyncSourceBox | ''>>();
  readonly boxSignal = computed<DbxHeightSyncSourceBox>(() => this.dbxHeightSyncSource() || 'border-box');

  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    const group = this.group;

    if (group != null && typeof ResizeObserver !== 'undefined') {
      const element = this.elementRef.nativeElement;
      const registration = group.registerSource();
      const observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        const height = this.boxSignal() === 'content-box' ? entry.contentRect.height : element.getBoundingClientRect().height;
        registration.setHeight(height);
      });

      observer.observe(element, { box: 'border-box' });

      this._destroyRef.onDestroy(() => {
        observer.disconnect();
        registration.destroy();
      });
    }
  }
}

/**
 * Marks an element that takes the height of the nearest {@link DbxHeightSyncDirective}'s tallest source. Sets a border-box height once a
 * source is measured. Does nothing without a group.
 *
 * @dbxWebComponent
 * @dbxWebSlug height-sync-follower
 * @dbxWebCategory layout
 * @dbxWebRelated height-sync, height-sync-source
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxHeightSync><div dbxHeightSyncSource>Measured</div><div dbxHeightSyncFollower>Follows</div></div>
 * ```
 */
@Directive({
  selector: '[dbxHeightSyncFollower]',
  standalone: true,
  host: {
    class: 'dbx-height-sync-follower',
    '[style.height.px]': 'heightSignal()',
    '[style.box-sizing]': `heightSignal() == null ? null : 'border-box'`
  }
})
export class DbxHeightSyncFollowerDirective {
  readonly group = inject(DbxHeightSyncDirective, { optional: true });

  /**
   * The height this element takes, or undefined while the group has no measured source.
   */
  readonly heightSignal = computed(() => this.group?.heightSignal());
}
