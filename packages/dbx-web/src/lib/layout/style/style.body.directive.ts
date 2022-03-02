import { Directive, ChangeDetectorRef, Renderer2 } from '@angular/core';
import { DbxStyleService } from './style.service';
import { AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';
import { delay } from 'rxjs';

/**
 * Used to style the body document using the style provided by DbxStyleService.
 */
@Directive({
  selector: '[dbxStyleBody]',
  host: {
    '[class]': 'style'
  }
})
export class DbxStyleBodyDirective extends AbstractSubscriptionDirective {

  private _currentStyle: string = '';

  constructor(private renderer: Renderer2, readonly styleService: DbxStyleService, private cdRef: ChangeDetectorRef) {
    super(styleService.style$.pipe(delay(0)).subscribe((style) => {
      this._currentStyle && this.renderer.removeClass(document.body, this._currentStyle);
      style && this.renderer.addClass(document.body, style);
      this._currentStyle = style;
      safeDetectChanges(this.cdRef);
    }));
  }

}
