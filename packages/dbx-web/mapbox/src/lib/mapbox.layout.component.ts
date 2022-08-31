import { skip, switchMap, first, startWith, shareReplay, throttleTime, map, distinctUntilChanged, BehaviorSubject, combineLatest, Subject, Observable } from 'rxjs';
import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DbxMapboxMapStore } from './mapbox.store';
import { Maybe } from '@dereekb/util';
import { dbxColorBackground, DbxThemeColor } from '@dereekb/dbx-web';
import { ResizedEvent } from 'angular-resize-event';
import { SubscriptionObject } from '@dereekb/rxjs';
import { MatDrawerContainer } from '@angular/material/sidenav';
import { MapboxEaseTo } from './mapbox';

export type DbxMapboxLayoutSide = 'left' | 'right';

/**
 * Responsive component meant to split a left and right column.
 *
 * The left column is smaller than the right column, which contains the primary content.
 *
 * Requires a TwoColumnsContextStore to be provided.
 */
@Component({
  selector: 'dbx-mapbox-layout',
  templateUrl: './mapbox.layout.component.html',
  styleUrls: ['./mapbox.layout.component.scss']
})
export class DbxMapboxLayoutComponent extends SubscriptionObject implements OnInit, OnDestroy {
  @ViewChild(MatDrawerContainer)
  readonly container!: MatDrawerContainer;

  @ViewChild('content', { read: ElementRef, static: true })
  readonly content!: ElementRef;

  private _resized = new Subject<void>();
  private _updateMargins = new Subject<void>();
  private _forceHasContent = new BehaviorSubject<boolean>(false);
  private _side = new BehaviorSubject<DbxMapboxLayoutSide>('right');
  private _openToggle = new BehaviorSubject<boolean>(true);
  private _color = new BehaviorSubject<Maybe<DbxThemeColor>>(undefined);
  private _toggleSub = new SubscriptionObject();

  readonly side$ = this._side.pipe(distinctUntilChanged(), shareReplay(1));

  readonly hasContent$ = combineLatest([this._forceHasContent, this.dbxMapboxMapStore.hasContent$]).pipe(
    map(([hasContent, forceHasContent]) => hasContent || forceHasContent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly opened$ = combineLatest([this.hasContent$, this._openToggle]).pipe(
    map(([hasContent, open]) => hasContent && open),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly position$: Observable<'start' | 'end'> = this.side$.pipe(
    map((x) => (x === 'right' ? 'end' : 'start')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly drawerClasses$ = combineLatest([this.side$, this.dbxMapboxMapStore.hasContent$, this.opened$]).pipe(
    //
    map(([side, hasContent, open]) => (hasContent ? 'has-drawer-content' : 'no-drawer-content') + ` ${side}-drawer ` + (open ? 'open-drawer' : '')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly drawerButtonClasses$ = combineLatest([this.dbxMapboxMapStore.hasContent$, this._color]).pipe(
    //
    map(([hasContent, color]) => dbxColorBackground(color)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonIcon$: Observable<string> = combineLatest([this.side$, this.opened$]).pipe(
    map(([side, opened]) => {
      let icons = ['chevron_right', 'chevron_left'];

      if (side === 'left') {
        icons = icons.reverse();
      }

      return opened ? icons[0] : icons[1];
    })
  );

  constructor(readonly dbxMapboxMapStore: DbxMapboxMapStore) {
    super();
  }

  ngOnInit(): void {
    this.subscription = (
      this.side$.pipe(
        switchMap(() =>
          this._resized.pipe(
            throttleTime(100, undefined, { leading: true, trailing: true }),
            map(() => 'r'),
            startWith('s')
          )
        )
      ) as Observable<'s' | 'r'>
    ).subscribe((reason) => {
      this.dbxMapboxMapStore.mapInstance$.subscribe((x) => {
        x.resize();

        // side changed
        if (reason === 's') {
          setTimeout(() => {
            this._updateMargins.next();
          });
        }
      });
    });

    this._toggleSub.subscription = combineLatest([this.opened$.pipe(distinctUntilChanged(), skip(1)), this._updateMargins]).subscribe(([opened]) => {
      let { right } = this.container._contentMargins;

      this.container.updateContentMargins();

      setTimeout(() => {
        const flip = opened ? 1 : -1;

        if (opened) {
          right = this.container._contentMargins.right;
        }

        right = (right || 0) * flip;

        const element: HTMLElement = this.content.nativeElement;
        const width = element.clientWidth;

        const easeTo: Observable<MapboxEaseTo> = this.dbxMapboxMapStore
          .calculateNextCenterOffsetWithScreenMarginChange({
            leftMargin: 0,
            rightMargin: right,
            fullWidth: width
          })
          .pipe(
            first(),
            map((center) => ({ to: { center, duration: 3200, essential: false } } as MapboxEaseTo))
          );

        this.dbxMapboxMapStore.easeTo(easeTo);
      });
    });
  }

  ngOnDestroy(): void {
    this._resized.complete();
    this._updateMargins.complete();
    this._side.complete();
    this._openToggle.complete();
    this._color.complete();
    this._toggleSub.destroy();
    this._forceHasContent.complete();
  }

  toggleDrawer(open?: boolean) {
    if (open == null) {
      open = !this._openToggle.value;
    }

    this._openToggle.next(open);
  }

  @Input()
  set side(side: Maybe<DbxMapboxLayoutSide>) {
    if (side != null) {
      this._side.next(side);
    }
  }

  @Input()
  set opened(opened: Maybe<boolean>) {
    if (opened != null) {
      this._openToggle.next(opened);
    }
  }

  @Input()
  set hasContent(hasContent: Maybe<boolean>) {
    if (hasContent != null) {
      this._forceHasContent.next(hasContent);
    }
  }

  @Input()
  set drawerColor(color: Maybe<DbxThemeColor>) {
    this._color.next(color);
  }

  onResized(event: ResizedEvent): void {
    this._resized.next();
  }
}
