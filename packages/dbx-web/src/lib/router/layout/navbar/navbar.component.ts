import { Observable, BehaviorSubject, combineLatest, map, shareReplay, distinctUntilChanged, switchMap } from 'rxjs';
import { ScreenMediaWidthType } from './../../../screen/screen';
import { DbxScreenMediaService } from '../../../screen/screen.service';
import { applyBestFit, findNext, Maybe } from '@dereekb/util';
import { Input, Component, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, TrackByFunction, inject } from '@angular/core';
import { ClickableAnchorLinkSegueRef, DbxRouterService, AbstractTransitionDirective, tapDetectChanges, DbxButtonDisplayContent } from '@dereekb/dbx-core';
import { HorizontalConnectionPos } from '@angular/cdk/overlay';

interface NavAnchorLink {
  selected: boolean;
  anchor: ClickableAnchorLinkSegueRef;
}

export type NavBarContentAlign = 'center' | 'left' | 'right';
export type NavbarMode = 'bar' | 'button' | 'icon';
export type NavbarButtonMode = 'menu' | 'rotate';

/**
 * Component that displays a navbar.
 */
@Component({
  selector: 'dbx-navbar',
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dbx-navbar'
  }
})
export class DbxNavbarComponent extends AbstractTransitionDirective implements OnDestroy {
  private readonly _dbxScreenMediaService = inject(DbxScreenMediaService);
  private readonly _dbxRouterService = inject(DbxRouterService);
  readonly cdRef = inject(ChangeDetectorRef);

  /**
   * Whether or not to show the dropwdown caret for a menu
   */
  @Input()
  showMenuCaret = false;

  @Input()
  navAlign: HorizontalConnectionPos = 'center';

  private _icon = new BehaviorSubject<Maybe<string>>(undefined);
  private _defaultIcon = new BehaviorSubject<Maybe<string>>('menu');
  private _defaultText = new BehaviorSubject<Maybe<string>>(undefined);

  private _inputMode = new BehaviorSubject<Maybe<NavbarMode>>(undefined);
  private _buttonMode = new BehaviorSubject<NavbarButtonMode>('menu');
  private _breakpoint = new BehaviorSubject<ScreenMediaWidthType>('large');
  private _anchors = new BehaviorSubject<ClickableAnchorLinkSegueRef[]>([]);

  readonly isBreakpointActive$ = this._dbxScreenMediaService.isBreakpointActive(this._breakpoint);

  readonly mode$ = combineLatest([this._inputMode, this.isBreakpointActive$]).pipe(
    map(([inputMode, breakpointActive]) => {
      return breakpointActive ? inputMode ?? 'bar' : 'button';
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

      return applyBestFit(
        results,
        (x) => x.selected,
        (a, b) => this._dbxRouterService.comparePrecision(a.anchor, b.anchor),
        (nonBestFit) => ({ ...nonBestFit, selected: false })
      );
    }),
    tapDetectChanges(this.cdRef),
    shareReplay(1)
  );

  readonly buttonMode$ = this._buttonMode.pipe(distinctUntilChanged(), shareReplay(1));

  readonly selectedAnchor$: Observable<Maybe<NavAnchorLink>> = this.anchors$.pipe(map((x) => x.find((y) => y.selected)));
  readonly nextRotateAnchor$: Observable<Maybe<NavAnchorLink>> = this.anchors$.pipe(map((x) => findNext(x, (y) => y.selected) || x[0]));

  readonly hasNoAnchors$ = this.anchors$.pipe(
    map((x) => x.length === 0),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonNavAnchor$ = this.buttonMode$.pipe(
    switchMap((x) => (x === 'menu' ? this.selectedAnchor$ : this.nextRotateAnchor$)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonDisplay$: Observable<DbxButtonDisplayContent> = combineLatest([this._defaultIcon, this._icon, this._defaultText, this.buttonNavAnchor$, this.mode$]).pipe(
    map(([defaultIcon, icon, defaultText, selectedAnchor, mode]) => {
      let content: DbxButtonDisplayContent;

      if (icon) {
        content = { icon, text: defaultText };
      } else if (selectedAnchor) {
        content = { icon: selectedAnchor.anchor.icon ?? defaultIcon, text: selectedAnchor.anchor.title };
      } else {
        content = { icon: defaultIcon ?? 'menu', text: defaultText };
      }

      if (mode === 'icon') {
        return { icon: content.icon };
      } else {
        return content;
      }
    }),
    shareReplay(1)
  );

  readonly trackByFunction: TrackByFunction<NavAnchorLink> = (index: number, item: NavAnchorLink) => item.anchor;

  // TODO: potentially make the caret depending on the current button display.

  ngOnDestroy(): void {
    this._icon.complete();
    this._defaultIcon.complete();
    this._defaultText.complete();
    this._inputMode.complete();
    this._buttonMode.complete();
    this._breakpoint.complete();
    this._anchors.complete();
  }

  // MARK: Accessors
  @Input()
  public set icon(icon: Maybe<string>) {
    this._icon.next(icon);
  }

  @Input()
  public set defaultIcon(defaultIcon: Maybe<string>) {
    this._defaultIcon.next(defaultIcon);
  }

  @Input()
  public set defaultText(defaultText: Maybe<string>) {
    this._defaultText.next(defaultText);
  }

  @Input()
  public set anchors(anchors: Maybe<ClickableAnchorLinkSegueRef[]>) {
    this._anchors.next(anchors ?? []);
  }

  @Input()
  public set buttonMode(mode: Maybe<NavbarButtonMode>) {
    this._buttonMode.next(mode ?? 'menu');
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
