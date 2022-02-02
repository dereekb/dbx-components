import { Observable } from 'rxjs';
import { ScreenMediaWidthType, screenMediaWidthTypeIsActive } from './../../../screen/screen';
import { DbxScreenMediaService } from '../../../screen/screen.service';
import { applyBestFit, Maybe } from '@dereekb/util';
import { Input, Component, NgZone, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ClickableAnchorLink, AbstractTransitionWatcherDirective, DbxRouterService, DbxRouterTransitionService, AbstractTransitionDirective, tapDetectChanges } from '@dereekb/dbx-core';
import { BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged, startWith, tap } from 'rxjs';

interface NavAnchorLink {
  selected: boolean;
  anchor: ClickableAnchorLink;
}

export type NavBarContentAlign = 'center' | 'left' | 'right';
export type NavbarMode = 'bar' | 'button';

/**
 * Component that displays a navbar.
 */
@Component({
  selector: 'dbx-navbar',
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxNavbarComponent extends AbstractTransitionDirective implements OnDestroy {

  @Input()
  navAlign = 'center';

  private _inputMode = new BehaviorSubject<Maybe<NavbarMode>>(undefined);
  private _breakpoint = new BehaviorSubject<ScreenMediaWidthType>('large');
  private _anchors = new BehaviorSubject<ClickableAnchorLink[]>([]);

  readonly isBreakpointActive$ = combineLatest([this._dbxScreenMediaService.widthType$, this._breakpoint]).pipe(
    map(([current, breakpoint]) => screenMediaWidthTypeIsActive(current, breakpoint)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly mode$ = combineLatest([this._inputMode, this.isBreakpointActive$]).pipe(
    map(([inputMode, breakpointActive]) => {
      return (breakpointActive) ? (inputMode ?? 'bar') : 'button';
    }),
    distinctUntilChanged(),
    tapDetectChanges(this.cdr),
    shareReplay(1)
  );

  readonly anchors$: Observable<NavAnchorLink[]> = combineLatest([this._anchors, this.initAndUpdateOnTransitionSuccess$]).pipe(
    map(([anchors]) => {
      const results = anchors.map((anchor) => {
        let selected = this._dbxRouterService.isActive(anchor);

        return {
          selected,
          anchor
        };
      });

      return applyBestFit(results, (x) => x.selected, (a, b) => this._dbxRouterService.comparePrecision(a.anchor, b.anchor), (loser) => ({ ...loser, selected: false }));
    }),
    tapDetectChanges(this.cdr),
    shareReplay(1)
  );

  constructor(
    dbxRouterTransitionService: DbxRouterTransitionService,
    private cdr: ChangeDetectorRef,
    private readonly _dbxScreenMediaService: DbxScreenMediaService,
    private readonly _dbxRouterService: DbxRouterService
  ) {
    super(dbxRouterTransitionService);
  }

  ngOnDestroy(): void {
    this._inputMode.complete();
    this._breakpoint.complete();
    this._anchors.complete();
  }

  // MARK: Accessors
  @Input()
  public set anchors(anchors: Maybe<ClickableAnchorLink[]>) {
    this._anchors.next(anchors ?? []);
  }

  @Input()
  public set mode(mode: Maybe<NavbarMode>) {
    this._inputMode.next(mode);
  }

  @Input()
  public set breakpoint(breakpoint: ScreenMediaWidthType) {
    this._breakpoint.next(breakpoint);
  }

}
