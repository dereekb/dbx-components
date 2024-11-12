import { OnDestroy, Input, Directive, inject } from '@angular/core';
import { AbstractIfDirective } from '@dereekb/dbx-core';
import { ArrayOrValue, Maybe, asArray, filterMaybeValues } from '@dereekb/util';
import { shareReplay, BehaviorSubject, switchMap, distinctUntilChanged, map } from 'rxjs';
import { DbxSidenavComponent } from './sidenav.component';
import { SideNavDisplayMode } from './sidenav';

/**
 * Structural directive that displays the content if the Sidenav has a specific sidenav size.
 */
@Directive({
  selector: '[dbxIfSidenavDisplayMode]'
})
export class DbxIfSidenavDisplayModeDirective extends AbstractIfDirective implements OnDestroy {
  private _sidenavModes = new BehaviorSubject<Set<SideNavDisplayMode>>(new Set([SideNavDisplayMode.NONE]));

  readonly dbxSidenavComponent = inject(DbxSidenavComponent);
  readonly show$ = this._sidenavModes.pipe(
    switchMap((modes) => {
      return this.dbxSidenavComponent.mode$.pipe(map((mode) => modes.has(mode)));
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  @Input('dbxIfSidenavDisplayMode')
  get modes() {
    return Array.from(this._sidenavModes.value);
  }

  set modes(modes: Maybe<ArrayOrValue<SideNavDisplayMode | string>>) {
    this._sidenavModes.next(new Set(filterMaybeValues(asArray(modes as SideNavDisplayMode))));
  }

  override ngOnDestroy(): void {
    this._sidenavModes.complete();
  }
}
