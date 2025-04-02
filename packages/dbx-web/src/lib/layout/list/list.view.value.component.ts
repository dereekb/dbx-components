import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, Signal, TrackByFunction, computed, inject, input } from '@angular/core';
import { shareReplay, map, Observable, BehaviorSubject, switchMap, of } from 'rxjs';
import { DbxValueListItem, AbstractDbxValueListViewConfig, DbxValueListItemConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { ClickableAnchorType, DbxInjectionComponent, anchorTypeForAnchor } from '@dereekb/dbx-core';
import { DbxListView } from './list.view';
import { Maybe, SpaceSeparatedCssClasses, spaceSeparatedCssClasses } from '@dereekb/util';
import { DbxValueListItemGroup, DbxValueListViewGroupDelegate, defaultDbxValueListViewGroupDelegate } from './list.view.value.group';
import { asObservable } from '@dereekb/rxjs';
import { MatListItem, MatNavList } from '@angular/material/list';
import { DbxAnchorComponent } from '../../router';
import { MatIcon } from '@angular/material/icon';

export interface DbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends AbstractDbxValueListViewConfig<T, I, V> {
  readonly emitAllClicks?: boolean;
}

/**
 * Content view for a DbxValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-view-content-group',
  template: `
    <div class="dbx-list-view-group-content">
      @if (headerConfigSignal()()) {
        <div class="dbx-list-view-group-header">
          <dbx-injection [config]="headerConfigSignal()()"></dbx-injection>
        </div>
      }
      @for (item of itemsSignal(); trackBy: trackByFunctionSignal()($index, item)) {
        <dbx-anchor [anchor]="item.anchor" [disabled]="item.disabled">
          <a mat-list-item class="dbx-list-view-item" [disabled]="item.disabled" [disableRipple]="rippleDisabledOnItem(item)" (click)="onClickItem(item)">
            @if (item.icon) {
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
            }
            <dbx-injection [config]="item.config"></dbx-injection>
            @if (item.metaConfig) {
              <span matListItemMeta>
                <dbx-injection [config]="item.metaConfig"></dbx-injection>
              </span>
            }
          </a>
        </dbx-anchor>
      }
      @if (footerConfigSignal()) {
        <div class="dbx-list-view-group-footer">
          <dbx-injection [config]="footerConfigSignal()"></dbx-injection>
        </div>
      }
    </div>
  `,
  host: {
    class: 'dbx-list-view-group',
    '[class]': 'cssClassesSignal()'
  },
  standalone: true,
  imports: [DbxInjectionComponent, DbxAnchorComponent, MatListItem, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListViewContentGroupComponent<G, T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly dbxValueListViewContentComponent = inject(DbxValueListViewContentComponent<T>);
  readonly group = input<Maybe<DbxValueListItemGroup<G, T, I>>>();

  private readonly _trackBySignal = toSignal(this.dbxValueListViewContentComponent.dbxListView.trackBy$ ?? of(undefined));

  readonly trackByFunctionSignal = computed(() => {
    const trackBy = this._trackBySignal();
    return trackBy ? (index: number, item: DbxValueListItemConfig<T, I>) => trackBy(index, item.itemValue) : () => undefined;
  });

  readonly itemsSignal = computed(() => this.group()?.items ?? []);
  readonly headerConfigSignal = computed(() => this.group()?.headerConfig);
  readonly footerConfigSignal = computed(() => this.group()?.footerConfig);
  readonly cssClassesSignal = computed(() => spaceSeparatedCssClasses(this.group()?.cssClasses));

  onClickItem(item: I) {
    this.dbxValueListViewContentComponent.onClickItem(item);
  }

  onClickValue(value: T) {
    this.dbxValueListViewContentComponent.onClickValue(value);
  }

  rippleDisabledOnItem(item: I): boolean {
    return this.dbxValueListViewContentComponent.rippleDisabledOnItem(item);
  }
}

// MARK: DbxValueListViewContentComponent
/**
 * Content view for a DbxValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-view-content',
  template: `
    <mat-nav-list [disabled]="disabledSignal()">
      @for (group; for: groups; track group.id) {
        <dbx-list-view-content-group [trackByFunction]="trackByFunction" [group]="group"></dbx-list-view-content-group>
      }
    </mat-nav-list>
  `,
  host: {
    class: 'dbx-list-view'
  },
  standalone: true,
  imports: [MatNavList, DbxValueListViewContentGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly dbxListView = inject(DbxListView<T>);

  private readonly _dbxListGroupDelegate: DbxValueListViewGroupDelegate<any, T, I> = inject<Maybe<DbxValueListViewGroupDelegate<any, T, I>>>(DbxValueListViewGroupDelegate, { optional: true }) ?? defaultDbxValueListViewGroupDelegate();

  readonly items = input<Maybe<DbxValueListItemConfig<T, I>[]>>();
  readonly emitAllClicks = input<Maybe<boolean>>();

  readonly groups$: Observable<DbxValueListItemGroup<any, T, I>[]> = toObservable(this.items).pipe(
    switchMap((items) => asObservable(this._dbxListGroupDelegate.groupValues(items ?? []))),
    shareReplay(1)
  );

  readonly groupsSignal = toSignal(this.groups$);
  readonly disabledSignal = toSignal(this.dbxListView.disabled$);

  onClickItem(item: I) {
    // do not emit clicks for disabled items.
    if (!item.disabled) {
      if (this.emitAllClicks() || !item.anchor || anchorTypeForAnchor(item.anchor) === 'plain') {
        // only emit clicks for items with no anchor, or plain anchors.
        this.onClickValue(item.itemValue);
      }
    }
  }

  onClickValue(value: T) {
    this.dbxListView.clickValue?.emit(value);
  }

  rippleDisabledOnItem(item: I): boolean {
    return item.rippleDisabled || (!this.emitAllClicks() && !item.anchor);
  }
}

// MARK: DbxValueListViewComponent
/**
 * Renders a list view using input configuration. Requires a parent DbxListView.
 */
@Component({
  selector: 'dbx-list-view',
  template: `
    <dbx-list-view-content [items]="itemsSignal()" [emitAllClicks]="emitAllClicksSignal()"></dbx-list-view-content>
  `,
  standalone: true,
  imports: [DbxValueListViewContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListViewConfig<T, I, V> = DbxValueListViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {
  readonly emitAllClicksSignal: Signal<Maybe<boolean>> = computed(() => this.config()?.emitAllClicks);
}
