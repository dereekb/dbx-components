import { Directive, inject, signal } from '@angular/core';
import { DbxStyleService } from './style.service';
import { cleanSubscription } from '@dereekb/dbx-core';
import { delay } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { DbxStyleClass } from './style';

/**
 * Used to retrieve the current app styling from the DbxStyleService.
 */
@Directive({
  selector: 'dbx-style, [dbxStyle], .dbx-style',
  host: {
    '[class]': 'styleClassNameSignal()'
  },
  standalone: true
})
export class DbxStyleDirective {
  private readonly _styleService = inject(DbxStyleService);

  readonly styleClassNameSignal = signal<Maybe<DbxStyleClass>>(undefined);

  constructor() {
    cleanSubscription(
      this._styleService.styleClassName$.pipe(delay(0)).subscribe((classes) => {
        this.styleClassNameSignal.set(classes);
      })
    );
  }
}
