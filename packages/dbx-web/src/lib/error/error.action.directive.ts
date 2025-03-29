import { Directive, OnInit, inject } from '@angular/core';
import { DbxActionContextStoreSourceInstance, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxErrorComponent } from './error.component';

/**
 * Context used for linking an ReadableErrorComponent to an ActionContext.
 */
@Directive({
  selector: '[dbxActionError]',
  standalone: true
})
export class DbxActionErrorDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly error = inject(DbxErrorComponent, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance);

  ngOnInit(): void {
    this.sub = this.source.error$.subscribe((error) => {
      this.error.error = error;
    });
  }
}
