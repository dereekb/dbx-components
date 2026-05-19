import { Directive, inject, signal } from '@angular/core';
import { DbxStyleService } from './style.service';
import { cleanSubscription } from '@dereekb/dbx-core';
import { delay } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { type DbxStyleClass } from './style';

/**
 * Applies the current application style class from {@link DbxStyleService} to the host element.
 *
 * Use this directive to propagate the active style class onto any element or component.
 *
 * @dbxWebComponent
 * @dbxWebSlug style
 * @dbxWebCategory layout
 * @dbxWebRelated style-service, style-body, set-style
 * @dbxWebMinimalExample ```html
 * <div dbxStyle></div>
 * ```
 *
 * @example
 * ```html
 * <div dbxStyle>Styled content</div>
 * ```
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
