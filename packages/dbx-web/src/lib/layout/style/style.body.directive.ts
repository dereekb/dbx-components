import { Directive, Renderer2, inject } from '@angular/core';
import { DbxStyleService } from './style.service';
import { cleanSubscription } from '@dereekb/dbx-core';
import { delay } from 'rxjs';
import { type CssClass } from '@dereekb/util';

/**
 * Applies the current {@link DbxStyleService} body application — the active style class, any supplement classes, and
 * supplement inline styles (CSS custom properties) — to the document `<body>` element.
 *
 * Place this directive on a root-level element so that the body tag receives the active style.
 *
 * @dbxWebComponent
 * @dbxWebSlug style-body
 * @dbxWebCategory layout
 * @dbxWebRelated style, style-service, set-style
 * @dbxWebMinimalExample ```html
 * <div dbxStyleBody></div>
 * ```
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

  private _classes: CssClass[] = [];
  private _styleKeys: string[] = [];

  constructor() {
    cleanSubscription(
      this._styleService.styleApplication$.pipe(delay(0)).subscribe((application) => {
        const nextClasses = application.classes.filter(Boolean);
        const nextClassSet = new Set(nextClasses);

        // Diff classes: remove ones no longer present, add new ones.
        this._classes.forEach((currentClass) => {
          if (!nextClassSet.has(currentClass)) {
            this._renderer.removeClass(document.body, currentClass);
          }
        });

        const currentClassSet = new Set(this._classes);

        nextClasses.forEach((nextClass) => {
          if (!currentClassSet.has(nextClass)) {
            this._renderer.addClass(document.body, nextClass);
          }
        });

        this._classes = nextClasses;

        // Diff inline styles: custom properties (e.g. --mat-sys-*) require setProperty/removeProperty.
        const bodyStyle = document.body.style;
        const nextStyle = application.style;
        const nextStyleKeys = Object.keys(nextStyle).filter((key) => nextStyle[key] != null);
        const nextStyleKeySet = new Set(nextStyleKeys);

        this._styleKeys.forEach((currentKey) => {
          if (!nextStyleKeySet.has(currentKey)) {
            bodyStyle.removeProperty(currentKey);
          }
        });

        nextStyleKeys.forEach((key) => {
          bodyStyle.setProperty(key, String(nextStyle[key]));
        });

        this._styleKeys = nextStyleKeys;
      })
    );
  }
}
