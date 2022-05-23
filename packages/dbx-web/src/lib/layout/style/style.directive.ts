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
    '[class]': 'style'
  }
})
export class DbxStyleDirective extends AbstractSubscriptionDirective {

  style = '';

  constructor(readonly styleService: DbxStyleService, private cdRef: ChangeDetectorRef) {
    super(styleService.style$.pipe(delay(0)).subscribe((style) => {
      this.style = style;
      safeDetectChanges(this.cdRef);
    }));
  }

}
