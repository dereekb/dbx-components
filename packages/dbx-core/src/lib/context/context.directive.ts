import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';
import { Directive, Input, OnDestroy, OnInit, effect, inject, input } from '@angular/core';
import { DbxAppContextService } from './context.service';
import { AbstractSubscriptionDirective } from '../subscription';
import { DbxAppContextState } from './context';
import { type Maybe } from '@dereekb/util';

/**
 * Used to set the DbxAppContextState for an app to the input state using the DbxAppContextService.
 */
@Directive({
  selector: '[dbxAppContextState]',
  standalone: true
})
export class DbxAppContextStateDirective {
  readonly dbxAppContextStateService = inject(DbxAppContextService);

  readonly state = input<Maybe<DbxAppContextState>>(undefined, { alias: 'dbxAppContextState' });

  protected readonly _stateEffect = effect(
    () => {
      const state = this.state();

      if (state != null) {
        this.dbxAppContextStateService.setState(state);
      }
    },
    { allowSignalWrites: true }
  );
}
