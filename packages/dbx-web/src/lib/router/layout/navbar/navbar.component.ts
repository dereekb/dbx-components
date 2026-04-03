import { type Observable, combineLatest, map, shareReplay, distinctUntilChanged, switchMap } from 'rxjs';
import { type ScreenMediaWidthType } from '../../../screen/screen';
import { DbxScreenMediaService } from '../../../screen/screen.service';
import { applyBestFit, findNext, isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';
import { type ClickableAnchorLinkSegueRef, DbxRouterService, AbstractTransitionDirective, type DbxButtonDisplay } from '@dereekb/dbx-core';
import { type HorizontalConnectionPos } from '@angular/cdk/overlay';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxAnchorComponent } from '../anchor';
import { MatTabLink, MatTabNav, MatTabNavPanel } from '@angular/material/tabs';
import { DbxButtonComponent } from '../../../button/button.component';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { NgClass } from '@angular/common';

/**
 * Internal representation of a navigation anchor with its selection state.
 */
interface NavAnchorLink {
  readonly selected: boolean;
  readonly anchor: ClickableAnchorLinkSegueRef;
}

/**
 * Horizontal alignment for navbar content.
 */
export type NavBarContentAlign = 'center' | 'left' | 'right';

/**
 * Display mode for the navbar: tab bar, button with dropdown/rotate, or icon-only button.
 */
export type NavbarMode = 'bar' | 'button' | 'icon';

/**
 * Button behavior when the navbar collapses to button mode: show a dropdown menu or rotate through anchors on click.
 */
export type NavbarButtonMode = 'menu' | 'rotate';

/**
 * Responsive navigation bar that displays anchor links as Material tabs, collapsing to a button menu or icon on smaller screens.
 *
 * Automatically selects the active anchor based on the current route and supports configurable breakpoints.
 *
 * @example
 * ```html
 * <dbx-navbar [anchors]="navAnchors" breakpoint="large" buttonMode="menu"></dbx-navbar>
 * <dbx-navbar [anchors]="navAnchors" mode="icon" [showMenuCaret]="true"></dbx-navbar>
 * ```
 */
@Component({
  selector: 'dbx-navbar',
  templateUrl: './navbar.component.html',
  host: {
    class: 'dbx-navbar'
  },
  imports: [DbxAnchorComponent, MatTabNav, MatTabNavPanel, MatTabLink, DbxButtonComponent, MatIconModule, MatMenu, MatMenuItem, NgClass, MatMenuTrigger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxNavbarComponent extends AbstractTransitionDirective {
  private readonly _dbxScreenMediaService = inject(DbxScreenMediaService);
  private readonly _dbxRouterService = inject(DbxRouterService);

  /**
   * Whether or not to show the dropwdown caret for a menu
   */
  readonly showMenuCaret = input<boolean>(false);

  readonly fab = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });

  readonly navAlign = input<HorizontalConnectionPos>('center');

  readonly icon = input<Maybe<string>>();
  readonly defaultIcon = input<Maybe<string>>('menu');
  readonly defaultText = input<Maybe<string>>();
  readonly mode = input<Maybe<NavbarMode>>();
  readonly buttonMode = input<NavbarButtonMode>('menu');
  readonly breakpoint = input<ScreenMediaWidthType>('large');
  readonly anchors = input<Maybe<ClickableAnchorLinkSegueRef[]>>([]);

  readonly isBreakpointActive$ = this._dbxScreenMediaService.isBreakpointActive(toObservable(this.breakpoint));

  readonly mode$ = combineLatest([toObservable(this.mode), this.isBreakpointActive$]).pipe(
    map(([inputMode, breakpointActive]) => {
      return breakpointActive ? (inputMode ?? 'bar') : 'button';
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly anchors$: Observable<NavAnchorLink[]> = combineLatest([toObservable(this.anchors), this.initAndUpdateOnTransitionSuccess$]).pipe(
    map(([anchors]) => {
      const results = (anchors || []).map((anchor) => {
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
    shareReplay(1)
  );

  readonly selectedAnchor$: Observable<Maybe<NavAnchorLink>> = this.anchors$.pipe(map((x) => x.find((y) => y.selected)));
  readonly nextRotateAnchor$: Observable<Maybe<NavAnchorLink>> = this.anchors$.pipe(map((x) => findNext(x, (y) => y.selected) || x[0]));

  readonly hasNoAnchors$ = this.anchors$.pipe(
    map((x) => x.length === 0),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonNavAnchor$ = toObservable(this.buttonMode).pipe(
    switchMap((x) => (x === 'menu' ? this.selectedAnchor$ : this.nextRotateAnchor$)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonDisplay$: Observable<DbxButtonDisplay> = combineLatest([toObservable(this.defaultIcon), toObservable(this.icon), toObservable(this.defaultText), this.buttonNavAnchor$, this.mode$]).pipe(
    map(([defaultIcon, icon, defaultText, selectedAnchor, mode]) => {
      let content: DbxButtonDisplay;

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

  readonly modeSignal = toSignal(this.mode$);
  readonly isIconModeSignal = toSignal(
    this.mode$.pipe(
      map((x) => x === 'icon'),
      distinctUntilChanged()
    )
  );
  readonly anchorsSignal = toSignal(this.anchors$);
  readonly buttonDisplaySignal = toSignal(this.buttonDisplay$);
  readonly hasNoAnchorsSignal = toSignal(this.hasNoAnchors$);
  readonly nextRotateAnchorSignal = toSignal(this.nextRotateAnchor$);

  // TODO: potentially make the caret depending on the current button display.
}
