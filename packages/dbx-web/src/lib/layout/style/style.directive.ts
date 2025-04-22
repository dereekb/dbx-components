import { Directive, inject, signal, OnInit } from '@angular/core';
import { DbxStyleService } from './style.service';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
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
export class DbxStyleDirective extends AbstractSubscriptionDirective implements OnInit {
  private readonly _styleService = inject(DbxStyleService);

  readonly styleClassNameSignal = signal<Maybe<DbxStyleClass>>(undefined);

  ngOnInit(): void {
    this.sub = this._styleService.styleClassName$.pipe(delay(0)).subscribe((classes) => {
      this.styleClassNameSignal.set(classes);
    });
  }
}
