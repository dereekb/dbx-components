import { Directive, ChangeDetectorRef, Renderer2, inject, signal, Signal } from '@angular/core';
import { DbxStyleService } from './style.service';
import { AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';
import { delay } from 'rxjs';
import { DbxStyleClass } from './style';
import { Maybe } from '@dereekb/util';

/**
 * Used to style the <body> element of the document document using the style provided by DbxStyleService.
 */
@Directive({
  selector: '[dbxStyleBody]',
  host: {
    '[class]': 'styleClassNameSignal()'
  },
  standalone: true
})
export class DbxStyleBodyDirective extends AbstractSubscriptionDirective {
  private readonly _styleService = inject(DbxStyleService);
  private readonly _renderer = inject(Renderer2);

  private readonly _styleClassNameSignal = signal<Maybe<DbxStyleClass>>(undefined);
  readonly styleClassNameSignal = this._styleClassNameSignal.asReadonly();

  ngOnInit(): void {
    this.sub = this._styleService.styleClassName$.pipe(delay(0)).subscribe((newClassStyleToApply) => {
      const currentStyle = this._styleClassNameSignal();

      if (currentStyle) {
        this._renderer.removeClass(document.body, currentStyle);
      }

      if (newClassStyleToApply) {
        this._renderer.addClass(document.body, newClassStyleToApply);
      }

      this._styleClassNameSignal.set(newClassStyleToApply);
    });
  }
}
