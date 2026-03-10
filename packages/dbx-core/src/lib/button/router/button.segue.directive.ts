import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { cleanSubscription } from '../../rxjs';
import { DbxButton } from '../button';
import { DbxRouterService } from '../../router/router/service/router.service';
import { type SegueRef } from '../../router/segue';

// MARK: Button Directives
/**
 * Navigates to a route when the host {@link DbxButton} is clicked, using the provided {@link SegueRef}.
 *
 * @example
 * ```html
 * <button dbxButton [dbxButtonSegue]="{ ref: '/dashboard' }">Go to Dashboard</button>
 * ```
 *
 * @example
 * ```typescript
 * readonly segue: SegueRef = { ref: '/settings', refType: 'url' };
 * ```
 *
 * ```html
 * <button dbxButton [dbxButtonSegue]="segue">Settings</button>
 * ```
 */
@Directive({
  selector: '[dbxButtonSegue]',
  standalone: true
})
export class DbxButtonSegueDirective {
  readonly dbxButton = inject(DbxButton);
  readonly dbxRouterService = inject(DbxRouterService);

  readonly segueRef = input<Maybe<SegueRef>>(undefined, { alias: 'dbxButtonSegue' });

  constructor() {
    cleanSubscription(() =>
      this.dbxButton.clicked$.subscribe(() => {
        const segueRef = this.segueRef();

        if (segueRef) {
          this.dbxRouterService.go(segueRef);
        }
      })
    );
  }
}
