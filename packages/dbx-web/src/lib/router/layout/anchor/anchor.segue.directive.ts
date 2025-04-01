import { computed, Directive, inject } from '@angular/core';
import { DbxInjectionTemplateConfig } from '@dereekb/dbx-core';
import { Observable, distinctUntilChanged, shareReplay, map } from 'rxjs';
import { DbxAnchorComponent } from './anchor.component';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Abstract implementation
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
