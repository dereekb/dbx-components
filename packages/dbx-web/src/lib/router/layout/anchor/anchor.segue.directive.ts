import { computed, Directive, inject } from '@angular/core';
import { type DbxInjectionTemplateConfig } from '@dereekb/dbx-core';
import { type Observable, distinctUntilChanged, shareReplay, map } from 'rxjs';
import { DbxAnchorComponent } from './anchor.component';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Abstract base directive for segue anchor implementations that bridges a parent {@link DbxAnchorComponent}
 * with a router-specific anchor rendering (e.g., Angular Router or UIRouter).
 *
 * Provides access to the parent anchor observable, template configuration, and navigation target.
 */
@Directive()
export abstract class AbstractDbxSegueAnchorDirective {
  readonly parent = inject(DbxAnchorComponent);

  readonly anchor$ = this.parent.anchor$;
  readonly templateConfig$: Observable<DbxInjectionTemplateConfig> = this.parent.templateRef$.pipe(
    distinctUntilChanged(),
    map((templateRef) => ({
      templateRef
    })),
    shareReplay(1)
  );

  readonly anchorSignal = toSignal(this.anchor$, { initialValue: undefined });
  readonly templateConfigSignal = toSignal(this.templateConfig$, { initialValue: undefined });

  readonly targetSignal = computed(() => this.anchorSignal()?.target);
}
