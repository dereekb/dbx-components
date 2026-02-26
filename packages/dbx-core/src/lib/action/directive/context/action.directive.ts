import { Directive, inject } from '@angular/core';
import { SecondaryActionContextStoreSource } from '../../action.store.source';
import { provideActionStoreSource } from '../../action.store.source.provide';
import { DbxActionContextBaseSource } from '../../action.holder';
import { clean } from '../../../rxjs/clean';

/**
 * Provides an DbxAction/DbxActionContext.
 */
@Directive({
  selector: 'dbx-action,[dbxAction]',
  exportAs: 'action,dbxAction',
  providers: provideActionStoreSource(DbxActionDirective),
  standalone: true
})
export class DbxActionDirective<T = unknown, O = unknown> extends DbxActionContextBaseSource<T, O> {
  constructor() {
    super(inject(SecondaryActionContextStoreSource<T, O>, { optional: true, host: true }));

    // during cleaning/onDestroy, queue the lockset for cleanup
    clean(() => {
      this.lockSet.destroyOnNextUnlock(() => {
        this.destroy();
      });
    });
  }
}
