import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, Optional, TrackByFunction } from '@angular/core';
import { shareReplay, map, Observable, BehaviorSubject, switchMap } from 'rxjs';
import { DbxValueListItem, AbstractDbxValueListViewConfig, DbxValueListItemConfig } from './list.view.value';
import { AbstractDbxValueListViewDirective } from './list.view.value.directive';
import { AnchorType, anchorTypeForAnchor } from '@dereekb/dbx-core';
import { DbxListView } from './list.view';
import { Maybe, SpaceSeparatedCssClasses, spaceSeparatedCssClasses } from '@dereekb/util';
import { DbxValueListItemGroup, DbxValueListViewGroupDelegate, defaultDbxValueListViewGroupDelegate } from './list.view.value.group';
import { asObservable } from '@dereekb/rxjs';

export interface DbxValueListViewConfig<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown> extends AbstractDbxValueListViewConfig<T, I, V> {
  emitAllClicks?: boolean;
}

/**
 * Renders a list view using input configuration. Requires a parent DbxListView.
 */
@Component({
  selector: 'dbx-list-view',
  template: `
    <dbx-list-view-content [items]="items$ | async" [emitAllClicks]="emitAllClicks$ | async"></dbx-list-view-content>
  `
})
export class DbxValueListViewComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>, V = unknown, C extends DbxValueListViewConfig<T, I, V> = DbxValueListViewConfig<T, I, V>> extends AbstractDbxValueListViewDirective<T, I, V, C> {
  readonly emitAllClicks$ = this.config$.pipe(
    map((x) => x.emitAllClicks),
    shareReplay(1)
  );
}

/**
 * Content view for a DbxValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-view-content',
  template: `
    <mat-nav-list [disabled]="disabled$ | async">
      <ng-container *ngFor="let group of groups$ | async; trackBy: trackGroupByFunction">
        <dbx-list-view-content-group [group]="group"></dbx-list-view-content-group>
      </ng-container>
    </mat-nav-list>
  `,
  host: {
    class: 'dbx-list-view'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListViewContentComponent<T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  readonly _dbxListGroupDelegate: DbxValueListViewGroupDelegate<any, T, I>;

  private _items = new BehaviorSubject<Maybe<DbxValueListItemConfig<T, I>[]>>(undefined);

  readonly groups$: Observable<DbxValueListItemGroup<any, T, I>[]> = this._items.pipe(
    switchMap((items) => asObservable(this._dbxListGroupDelegate.groupValues(items ?? []))),
    shareReplay(1)
  );

  @Input()
  emitAllClicks?: Maybe<boolean>;

  readonly disabled$ = this.dbxListView.disabled$;

  readonly trackByFunction: TrackByFunction<DbxValueListItemConfig<T, I>>;
  readonly trackGroupByFunction: TrackByFunction<DbxValueListItemGroup<any, T, I>> = (_, v) => {
    return v.id; // track by the id
  };

  constructor(readonly dbxListView: DbxListView<T>, @Optional() @Inject(DbxValueListViewGroupDelegate) inputDbxListGroupDelegate: Maybe<DbxValueListViewGroupDelegate<any, T, I>>) {
    this._dbxListGroupDelegate = inputDbxListGroupDelegate ?? defaultDbxValueListViewGroupDelegate();
    const trackBy = dbxListView.trackBy;
    this.trackByFunction = trackBy ? (index: number, item: DbxValueListItemConfig<T, I>) => trackBy(index, item.itemValue) : () => undefined;
  }

  ngOnDestroy(): void {
    this._items.complete();
  }

  @Input()
  get items(): Maybe<DbxValueListItemConfig<T, I>[]> {
    return this._items.value;
  }

  set items(items: Maybe<DbxValueListItemConfig<T, I>[]>) {
    this._items.next(items);
  }

  onClickItem(item: I) {
    // do not emit clicks for disabled items.
    if (!item.disabled) {
      if (this.emitAllClicks || !item.anchor || anchorTypeForAnchor(item.anchor) === AnchorType.PLAIN) {
        // only emit clicks for items with no anchor, or plain anchors.
        this.onClickValue(item.itemValue);
      }
    }
  }

  onClickValue(value: T) {
    this.dbxListView.clickValue?.next(value);
  }

  rippleDisabledOnItem(item: I): boolean {
    return item.rippleDisabled || (!this.emitAllClicks && !item.anchor);
  }
}

/**
 * Content view for a DbxValueListView. It can be used directly in cases where the items are already configured, or want to be configured in a non-standard fashion.
 */
@Component({
  selector: 'dbx-list-view-content-group',
  template: `
    <div class="dbx-list-view-group-content">
      <div class="dbx-list-view-group-header" *ngIf="headerConfig">
        <dbx-injection [config]="headerConfig"></dbx-injection>
      </div>
      <dbx-anchor *ngFor="let item of items; trackBy: trackByFunction" [anchor]="item.anchor" [disabled]="item.disabled">
        <a mat-list-item class="dbx-list-view-item" [disabled]="item.disabled" [disableRipple]="rippleDisabledOnItem(item)" (click)="onClickItem(item)">
          <mat-icon matListItemIcon *ngIf="item.icon">{{ item.icon }}</mat-icon>
          <dbx-injection [config]="item.config"></dbx-injection>
        </a>
      </dbx-anchor>
      <div class="dbx-list-view-group-footer" *ngIf="footerConfig">
        <dbx-injection [config]="footerConfig"></dbx-injection>
      </div>
    </div>
  `,
  host: {
    class: 'dbx-list-view-group',
    '[class]': 'cssClasses'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxValueListViewContentGroupComponent<G, T, I extends DbxValueListItem<T> = DbxValueListItem<T>> {
  private _group: Maybe<DbxValueListItemGroup<G, T, I>>;
  private _cssClasses: Maybe<SpaceSeparatedCssClasses>;

  get cssClasses() {
    return this._cssClasses;
  }

  get items(): Maybe<DbxValueListItemConfig<T, I>[]> {
    return this._group?.items;
  }

  get headerConfig() {
    return this._group?.headerConfig;
  }

  get footerConfig() {
    return this._group?.footerConfig;
  }

  readonly disabled$: Observable<boolean>;
  readonly trackByFunction: TrackByFunction<DbxValueListItemConfig<T, I>>;

  constructor(readonly dbxValueListViewContentComponent: DbxValueListViewContentComponent<T>, readonly cdRef: ChangeDetectorRef) {
    this.disabled$ = this.dbxValueListViewContentComponent.disabled$;
    this.trackByFunction = this.dbxValueListViewContentComponent.trackByFunction;
  }

  @Input()
  get group() {
    return this._group;
  }

  set group(group: Maybe<DbxValueListItemGroup<G, T, I>>) {
    this._group = group;
    this._cssClasses = spaceSeparatedCssClasses(group?.cssClasses);
    this.cdRef.markForCheck();
  }

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
