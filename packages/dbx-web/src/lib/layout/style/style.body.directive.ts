import { Directive, ChangeDetectorRef, Renderer2, inject } from '@angular/core';
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
  private readonly _renderer = inject(Renderer2);
  readonly styleService = inject(DbxStyleService);
  readonly cdRef = inject(ChangeDetectorRef);

  private _currentStyle = '';

  ngOnInit(): void {
    this.sub = this.styleService.style$.pipe(delay(0)).subscribe((style) => {
      this._currentStyle && this._renderer.removeClass(document.body, this._currentStyle);
      style && this._renderer.addClass(document.body, style);
      this._currentStyle = style;
      safeDetectChanges(this.cdRef);
    });
  }
}
