import { Directive, ChangeDetectorRef } from '@angular/core';
import { DbxStyleService } from './style.service';
import { AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';
import { delay } from 'rxjs';

/**
 * Used to retrieve the current app styling from the DbxStyleService.
 */
@Directive({
  selector: 'dbx-style, [dbxStyle], .dbx-style',
  host: {
    '[class]': 'cssClass'
  }
})
export class DbxStyleDirective extends AbstractSubscriptionDirective {
  cssClass = '';

  constructor(readonly styleService: DbxStyleService, private cdRef: ChangeDetectorRef) {
    super(
      styleService.style$.pipe(delay(0)).subscribe((classes) => {
        this.cssClass = classes;
        safeDetectChanges(this.cdRef);
      })
    );
  }
}
