import { Directive, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '../../subscription/subscription.directive';
import { DbxButton } from '../button';
import { DbxRouterService } from '../../router/router/service/router.service';
import { SegueRef } from '../../router/segue';

// MARK: Button Directives
@Directive({
  selector: '[dbxButtonSegue]',
  standalone: true
})
export class DbxButtonSegueDirective extends AbstractSubscriptionDirective {
  readonly dbxButton = inject(DbxButton);
  readonly dbxRouterService = inject(DbxRouterService);

  readonly segueRef = input<Maybe<SegueRef>>(undefined, { alias: 'dbxButtonSegue' });

  constructor() {
    super();
    this.sub = this.dbxButton.clicked$.subscribe(() => {
      const segueRef = this.segueRef();

      if (segueRef) {
        this.dbxRouterService.go(segueRef);
      }
    });
  }
}
