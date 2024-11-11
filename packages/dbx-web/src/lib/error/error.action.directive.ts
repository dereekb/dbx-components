import { Directive, Host, OnInit, inject } from '@angular/core';
import { DbxActionContextStoreSourceInstance, AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxReadableErrorComponent } from './error.component';

/**
 * Context used for linking an ReadableErrorComponent to an ActionContext.
 */
@Directive({
  selector: '[dbxActionError]'
})
export class DbxActionErrorDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly error = inject(DbxReadableErrorComponent, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance);

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = this.source.error$.subscribe((error) => {
      this.error.error = error;
    });
  }
}
