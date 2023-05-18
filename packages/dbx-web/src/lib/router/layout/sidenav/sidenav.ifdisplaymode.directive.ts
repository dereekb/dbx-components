import { OnDestroy, Input, TemplateRef, ViewContainerRef, Directive } from '@angular/core';
import { AbstractIfDirective } from '@dereekb/dbx-core';
import { emitDelayObs } from '@dereekb/rxjs';
import { ArrayOrValue, Maybe, asArray, filterMaybeValues } from '@dereekb/util';
import { of, exhaustMap, shareReplay, BehaviorSubject, combineLatest, switchMap, distinctUntilChanged, map } from 'rxjs';
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

  readonly show$ = this._sidenavModes.pipe(
    switchMap((modes) => {
      return this.dbxSidenavComponent.mode$.pipe(
        map((mode) => {
          console.log({ mode, modes });
          return modes.has(mode);
        })
      );
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor(templateRef: TemplateRef<unknown>, viewContainer: ViewContainerRef, public readonly dbxSidenavComponent: DbxSidenavComponent) {
    super(templateRef, viewContainer);
  }

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
