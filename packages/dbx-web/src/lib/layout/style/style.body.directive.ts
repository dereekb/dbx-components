import { Directive, Renderer2, inject } from '@angular/core';
import { DbxStyleService } from './style.service';
import { cleanSubscription } from '@dereekb/dbx-core';
import { delay } from 'rxjs';
import { type DbxStyleClass } from './style';
import { type Maybe } from '@dereekb/util';

/**
 * Applies the current application style class from {@link DbxStyleService} to the document `<body>` element.
 *
 * Place this directive on a root-level element so that the body tag receives the active style class.
 *
 * @example
 * ```html
 * <div dbxStyleBody></div>
 * ```
 */
@Directive({
  selector: '[dbxStyleBody]',
  standalone: true
})
export class DbxStyleBodyDirective {
  private readonly _styleService = inject(DbxStyleService);
  private readonly _renderer = inject(Renderer2);

  private _styleClassName: Maybe<DbxStyleClass> = undefined;

  constructor() {
    cleanSubscription(
      this._styleService.styleClassName$.pipe(delay(0)).subscribe((newClassStyleToApply) => {
        const currentStyle = this._styleClassName;

        if (currentStyle) {
          this._renderer.removeClass(document.body, currentStyle);
        }

        if (newClassStyleToApply) {
          this._renderer.addClass(document.body, newClassStyleToApply);
        }

        this._styleClassName = newClassStyleToApply;
      })
    );
  }
}
