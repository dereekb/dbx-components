import { input, Directive, inject, computed, type Signal } from '@angular/core';
import { AbstractIfDirective } from '@dereekb/dbx-core';
import { type ArrayOrValue, type Maybe, asArray, filterMaybeArrayValues } from '@dereekb/util';
import { shareReplay, switchMap, distinctUntilChanged, map } from 'rxjs';
import { DbxSidenavComponent } from './sidenav.component';
import { type SideNavDisplayMode } from './sidenav';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

/**
 * Structural directive that displays the content if the Sidenav has a specific sidenav size.
 */
@Directive({
  selector: '[dbxIfSidenavDisplayMode]',
  standalone: true
})
export class DbxIfSidenavDisplayModeDirective extends AbstractIfDirective {
  readonly dbxSidenavComponent = inject(DbxSidenavComponent);

  readonly modes = input<Maybe<ArrayOrValue<SideNavDisplayMode | string>>>(undefined, { alias: 'dbxIfSidenavDisplayMode' });

  readonly modesSetSignal: Signal<Set<SideNavDisplayMode>> = computed(() => {
    const modes = this.modes();
    return new Set(filterMaybeArrayValues(asArray(modes as SideNavDisplayMode)));
  });

  readonly modes$ = toObservable(this.modesSetSignal);

  readonly show$ = this.modes$.pipe(
    switchMap((modes) => {
      return this.dbxSidenavComponent.mode$.pipe(map((mode) => modes.has(mode)));
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly showSignal = toSignal(this.show$, { initialValue: false });
}
