import { Directive } from '@angular/core';
import { DbxInjectionTemplateConfig } from '@dereekb/dbx-core';
import { Observable, distinctUntilChanged, shareReplay, map } from 'rxjs';
import { DbxAnchorComponent } from './anchor.component';

/**
 * Abstract implementation
 */
@Directive()
export abstract class AbstractDbxSegueAnchorDirective {
  readonly target$ = this.parent.target$;

  readonly ref$ = this.parent.anchor$.pipe(
    map((x) => x?.ref),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly refParams$ = this.parent.anchor$.pipe(
    map((x) => x?.refParams),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly refOptions$ = this.parent.anchor$.pipe(
    map((x) => x?.refOptions),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor(readonly parent: DbxAnchorComponent) {}

  readonly template$: Observable<DbxInjectionTemplateConfig> = this.parent.templateRef$.pipe(
    distinctUntilChanged(),
    map((templateRef) => ({
      templateRef
    })),
    shareReplay(1)
  );

  get anchor() {
    return this.parent.anchor;
  }
}
