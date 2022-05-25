import { Observable, BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged } from 'rxjs';
import { ScreenMediaWidthType } from './../../../screen/screen';
import { DbxScreenMediaService } from '../../../screen/screen.service';
import { applyBestFit, Maybe } from '@dereekb/util';
import { Input, Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ClickableAnchorLinkSegueRef, DbxRouterService, DbxRouterTransitionService, AbstractTransitionDirective, tapDetectChanges } from '@dereekb/dbx-core';
import { HorizontalConnectionPos } from '@angular/cdk/overlay';

interface NavAnchorLink {
  selected: boolean;
  anchor: ClickableAnchorLinkSegueRef;
}

export type NavBarContentAlign = 'center' | 'left' | 'right';
export type NavbarMode = 'bar' | 'button';

/**
 * Component that displays a navbar.
 */
@Component({
  selector: 'dbx-navbar',
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'dbx-navbar'
  }
})
export class DbxNavbarComponent extends AbstractTransitionDirective implements OnDestroy {

  @Input()
  navAlign: HorizontalConnectionPos = 'center';

  private _inputMode = new BehaviorSubject<Maybe<NavbarMode>>(undefined);
  private _breakpoint = new BehaviorSubject<ScreenMediaWidthType>('large');
  private _anchors = new BehaviorSubject<ClickableAnchorLinkSegueRef[]>([]);

  readonly isBreakpointActive$ = this._dbxScreenMediaService.isBreakpointActive(this._breakpoint);

  readonly mode$ = combineLatest([this._inputMode, this.isBreakpointActive$]).pipe(
    map(([inputMode, breakpointActive]) => {
      return (breakpointActive) ? (inputMode ?? 'bar') : 'button';
    }),
    distinctUntilChanged(),
    tapDetectChanges(this.cdRef),
    shareReplay(1)
  );

  readonly anchors$: Observable<NavAnchorLink[]> = combineLatest([this._anchors, this.initAndUpdateOnTransitionSuccess$]).pipe(
    map(([anchors]) => {
      const results = anchors.map((anchor) => {
        const selected = this._dbxRouterService.isActive(anchor);

        return {
          selected,
          anchor
        };
      });

      return applyBestFit(results, (x) => x.selected, (a, b) => this._dbxRouterService.comparePrecision(a.anchor, b.anchor), (loser) => ({ ...loser, selected: false }));
    }),
    tapDetectChanges(this.cdRef),
    shareReplay(1)
  );

  constructor(
    dbxRouterTransitionService: DbxRouterTransitionService,
    private cdRef: ChangeDetectorRef,
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
  public set anchors(anchors: Maybe<ClickableAnchorLinkSegueRef[]>) {
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
