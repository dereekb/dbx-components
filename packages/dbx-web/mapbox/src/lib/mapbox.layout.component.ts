import { tap, switchMap, first, startWith, shareReplay, throttleTime, map, distinctUntilChanged, BehaviorSubject, combineLatest, Subject, Observable } from 'rxjs';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject } from '@angular/core';
import { DbxMapboxMapStore } from './mapbox.store';
import { type Maybe } from '@dereekb/util';
import { DbxThemeColor } from '@dereekb/dbx-web';
import { ResizedEvent } from 'angular-resize-event-package';
import { SubscriptionObject } from '@dereekb/rxjs';
import { MatDrawerContainer } from '@angular/material/sidenav';
import { MapboxEaseTo } from './mapbox';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';

export type DbxMapboxLayoutSide = 'left' | 'right';

export type DbxMapboxLayoutMode = 'side' | 'push';

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
export class DbxMapboxLayoutComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  @Output()
  readonly openedChange = new EventEmitter<boolean>();

  @ViewChild(MatDrawerContainer, { read: ElementRef })
  readonly containerElement!: ElementRef;

  @ViewChild(MatDrawerContainer)
  readonly drawerContainer!: MatDrawerContainer;

  @ViewChild('content', { read: ElementRef, static: true })
  readonly content!: ElementRef;

  private readonly _resized = new Subject<ResizedEvent>();
  private readonly _updateMargins = new Subject<void>();
  private readonly _forceHasContent = new BehaviorSubject<boolean>(false);
  private readonly _mode = new BehaviorSubject<DbxMapboxLayoutMode>('side');
  private readonly _side = new BehaviorSubject<DbxMapboxLayoutSide>('right');
  private readonly _isOpen = new BehaviorSubject<boolean>(true);
  private readonly _color = new BehaviorSubject<Maybe<DbxThemeColor>>('background');
  private readonly _toggleSub = new SubscriptionObject();

  readonly resized$ = this._resized.asObservable();
  readonly side$ = this._side.pipe(distinctUntilChanged(), shareReplay(1));
  readonly mode$: Observable<DbxMapboxLayoutMode> = this._mode.pipe(distinctUntilChanged(), shareReplay(1));

  readonly hasContent$ = combineLatest([this._forceHasContent, this.dbxMapboxMapStore.hasContent$]).pipe(
    map(([hasContent, forceHasContent]) => hasContent || forceHasContent),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isOpen$ = this._isOpen.asObservable();

  readonly isOpenAndHasContent$ = combineLatest([this.hasContent$, this._isOpen]).pipe(
    map(([hasContent, open]) => hasContent && open),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly position$: Observable<'start' | 'end'> = this.side$.pipe(
    map((x) => (x === 'right' ? 'end' : 'start')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly drawerClasses$ = combineLatest([this.side$, this.dbxMapboxMapStore.hasContent$, this.isOpenAndHasContent$]).pipe(
    //
    map(([side, hasContent, open]) => (hasContent ? 'has-drawer-content' : 'no-drawer-content') + ` ${side}-drawer ` + (open ? 'open-drawer' : '')),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly drawerButtonColor$ = this._color.pipe(distinctUntilChanged(), shareReplay(1));

  readonly buttonIcon$: Observable<string> = combineLatest([this.side$, this.isOpenAndHasContent$]).pipe(
    map(([side, opened]) => {
      let icons = ['chevron_right', 'chevron_left'];

      if (side === 'left') {
        icons = icons.reverse();
      }

      return opened ? icons[0] : icons[1];
    })
  );

  ngOnInit(): void {
    this.sub = (
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

    let init = false;

    this._toggleSub.subscription = this.mode$
      .pipe(
        switchMap((mode) => {
          let obs: Observable<unknown>;

          if (mode === 'push') {
            obs = combineLatest([this.isOpenAndHasContent$.pipe(distinctUntilChanged()), this._updateMargins]).pipe(
              tap(([opened]) => {
                let { right } = this.drawerContainer._contentMargins;

                this.drawerContainer.updateContentMargins();

                setTimeout(() => {
                  const flip = opened ? 1 : -1;

                  if (opened) {
                    right = this.drawerContainer._contentMargins.right;
                  }

                  right = (right || 0) * flip;

                  const element: HTMLElement = this.content.nativeElement;
                  const width = element.clientWidth;

                  const margin = {
                    leftMargin: 0,
                    rightMargin: right,
                    fullWidth: width
                  };

                  const easeTo: Observable<MapboxEaseTo> = this.dbxMapboxMapStore.calculateNextCenterOffsetWithScreenMarginChange(margin).pipe(
                    first(),
                    map((center) => ({ to: { center, duration: 3200, essential: false } } as MapboxEaseTo))
                  );

                  this.dbxMapboxMapStore.setMargin(opened ? margin : undefined);

                  if (!init) {
                    this.dbxMapboxMapStore.easeTo(easeTo);
                  } else {
                    init = true;
                  }
                });
              })
            );
          } else {
            obs = combineLatest([this.isOpenAndHasContent$.pipe(distinctUntilChanged()), this._updateMargins]).pipe(
              switchMap((_) => this.dbxMapboxMapStore.mapInstance$),
              tap((x) => {
                this.drawerContainer.updateContentMargins();
                x.triggerRepaint();
              })
            );
          }

          return obs;
        })
      )
      .subscribe();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.openedChange.complete();
    this._resized.complete();
    this._updateMargins.complete();
    this._side.complete();
    this._isOpen.complete();
    this._color.complete();
    this._toggleSub.destroy();
    this._forceHasContent.complete();
  }

  toggleDrawer(open?: boolean) {
    if (open == null) {
      open = !this._isOpen.value;
    }

    this._isOpen.next(open);
  }

  @Input()
  set side(side: Maybe<DbxMapboxLayoutSide>) {
    if (side != null) {
      this._side.next(side);
    }
  }

  @Input()
  set mode(mode: Maybe<DbxMapboxLayoutMode>) {
    if (mode != null) {
      this._mode.next(mode);
    }
  }

  @Input()
  set opened(opened: Maybe<boolean>) {
    if (opened != null) {
      this._isOpen.next(opened);
    }
  }

  @Input()
  set hasContent(hasContent: Maybe<boolean>) {
    if (hasContent != null) {
      this._forceHasContent.next(hasContent);
    }
  }

  @Input()
  set drawerButtonColor(color: Maybe<DbxThemeColor>) {
    this._color.next(color);
  }

  onResized(event: ResizedEvent): void {
    this._resized.next(event);
  }

  onOpened(opened: boolean) {
    this.openedChange.next(opened);

    if (this._isOpen.value !== opened) {
      this.openedChange.next(opened);
    }
  }
}
