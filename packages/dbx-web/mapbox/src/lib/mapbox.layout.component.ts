import { tap, switchMap, first, startWith, throttleTime, map, distinctUntilChanged, combineLatest, Subject, Observable, delay } from 'rxjs';
import { Component, ElementRef, OnDestroy, OnInit, inject, signal, computed, input, output, viewChild, ChangeDetectionStrategy, Signal, effect } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { DbxMapboxMapStore } from './mapbox.store';
import { type Maybe } from '@dereekb/util';
import { DbxColorDirective, DbxThemeColor } from '@dereekb/dbx-web';
import { AngularResizeEventModule, ResizedEvent } from 'angular-resize-event-package';
import { SubscriptionObject } from '@dereekb/rxjs';
import { MatDrawer, MatDrawerContainer, MatDrawerContent } from '@angular/material/sidenav';
import { MapboxEaseTo } from './mapbox';
import { NgClass } from '@angular/common';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DbxMapboxLayoutDrawerComponent } from './mapbox.layout.drawer.component';

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
  styleUrls: ['./mapbox.layout.component.scss'],
  imports: [AngularResizeEventModule, NgClass, DbxMapboxLayoutDrawerComponent, MatDrawer, MatDrawerContainer, MatDrawerContent, MatIconModule, MatIconButton, DbxColorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxMapboxLayoutComponent implements OnInit, OnDestroy {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);

  private readonly _viewResized = new Subject<ResizedEvent>();
  private readonly _refreshContentMargins = new Subject<void>();

  readonly drawerOpenedChange = output<boolean>();

  readonly drawerContainer = viewChild.required<MatDrawerContainer>(MatDrawerContainer);
  readonly drawerContainerElement = viewChild.required<MatDrawerContainer, ElementRef<HTMLElement>>(MatDrawerContainer, { read: ElementRef<HTMLElement> });
  readonly drawerContent = viewChild.required<ElementRef<HTMLElement>>('drawerContent');

  readonly side = input<DbxMapboxLayoutSide, Maybe<DbxMapboxLayoutSide>>('right', { transform: (x) => x || 'right' });
  readonly mode = input<DbxMapboxLayoutMode, Maybe<DbxMapboxLayoutMode>>('side', { transform: (x) => x || 'side' });

  /**
   * Forces the drawer to assume the drawer has content if true, or assume it has no content if false.
   */
  readonly forceHasDrawerContent = input<Maybe<boolean>>(undefined);
  readonly drawerButtonColor = input<DbxThemeColor, Maybe<DbxThemeColor>>('background', { transform: (x) => x ?? 'background' });

  readonly openDrawer = input<Maybe<boolean>>(undefined); // input open/close drawer config
  readonly isDrawerOpenSignal = signal<Maybe<boolean>>(undefined); // Signal to toggle the drawer

  protected readonly _openDrawerEffect = effect(
    () => {
      this.isDrawerOpenSignal.set(this.openDrawer());
    },
    { allowSignalWrites: true }
  );

  readonly storeHasDrawerContent = toSignal(this.dbxMapboxMapStore.hasDrawerContent$);
  readonly drawerHasContentSignal = computed(() => this.forceHasDrawerContent() ?? this.storeHasDrawerContent());

  readonly refreshContentMargins$ = this._refreshContentMargins;

  readonly isOpenAndHasContentSignal = computed(() => {
    return this.drawerHasContentSignal() && this.isDrawerOpenSignal();
  });

  readonly viewResized$ = this._viewResized.asObservable();
  readonly side$ = toObservable(this.side);
  readonly mode$ = toObservable(this.mode);
  readonly drawerHasContent$ = toObservable(this.drawerHasContentSignal);
  readonly isOpenAndHasContent$ = toObservable(this.isOpenAndHasContentSignal);

  readonly positionSignal: Signal<'start' | 'end'> = computed(() => {
    return this.side() === 'right' ? 'end' : 'start';
  });

  readonly drawerClassesSignal = computed(() => {
    const side = this.side();
    const hasContent = this.drawerHasContentSignal();
    const isOpen = this.isDrawerOpenSignal(); // NOTE: isOpenAndHasContentSignal is not used here

    return (hasContent ? 'has-drawer-content' : 'no-drawer-content') + ` ${side}-drawer ` + (isOpen ? 'open-drawer' : '');
  });

  readonly buttonIconSignal = computed(() => {
    const side = this.side();
    const opened = this.isDrawerOpenSignal(); // NOTE: isOpenAndHasContentSignal is not used here

    let icons = ['chevron_right', 'chevron_left'];

    if (side === 'left') {
      icons = icons.reverse();
    }

    return opened ? icons[0] : icons[1];
  });

  private readonly _reszieSyncSub = new SubscriptionObject();
  private readonly _toggleSyncSub = new SubscriptionObject();

  ngOnInit(): void {
    this._reszieSyncSub.subscription = (
      this.side$.pipe(
        switchMap(() =>
          this._viewResized.pipe(
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
          this._refreshContentMargins.next();
        }
      });
    });

    let init = false;

    this._toggleSyncSub.subscription = this.mode$
      .pipe(
        switchMap((mode) => {
          let obs: Observable<unknown>;

          if (mode === 'push') {
            obs = combineLatest([this.isOpenAndHasContent$.pipe(distinctUntilChanged()), this.refreshContentMargins$]).pipe(
              tap(([opened]) => {
                const drawerContainer = this.drawerContainer();

                let { right } = drawerContainer._contentMargins;

                drawerContainer.updateContentMargins();

                setTimeout(() => {
                  const flip = opened ? 1 : -1;

                  if (opened) {
                    right = drawerContainer._contentMargins.right;
                  }

                  right = (right || 0) * flip;

                  const element: HTMLElement = this.drawerContent().nativeElement;
                  const width = element.clientWidth;

                  const margin = {
                    leftMargin: 0,
                    rightMargin: right,
                    fullWidth: width
                  };

                  const easeTo: Observable<MapboxEaseTo> = this.dbxMapboxMapStore.calculateNextCenterOffsetWithScreenMarginChange(margin).pipe(
                    first(),
                    map((center) => ({ to: { center, duration: 3200, essential: false } }) as MapboxEaseTo)
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
            obs = combineLatest([this.isOpenAndHasContent$.pipe(distinctUntilChanged()), this._refreshContentMargins.pipe(delay(0))]).pipe(
              switchMap((_) => this.dbxMapboxMapStore.mapInstance$),
              tap((map) => {
                this.drawerContainer().updateContentMargins();
                map.triggerRepaint();
              })
            );
          }

          return obs;
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._viewResized.complete();
    this._refreshContentMargins.complete();
    this._reszieSyncSub.destroy();
    this._toggleSyncSub.destroy();
  }

  viewResized(event: ResizedEvent): void {
    this._viewResized.next(event);
  }

  drawerOpened(opened: boolean) {
    const currentToggleState = this.isDrawerOpenSignal();

    if (currentToggleState !== opened) {
      this.toggleDrawer(opened); // sync with drawer toggling
      this.drawerOpenedChange.emit(opened);
    }
  }

  toggleDrawer(open?: Maybe<boolean>) {
    if (open == null) {
      open = !this.isDrawerOpenSignal();
    }

    this.isDrawerOpenSignal.set(open);
  }
}
