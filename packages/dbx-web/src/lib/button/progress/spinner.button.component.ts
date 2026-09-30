import { Component, computed, ElementRef, viewChild } from '@angular/core';
import { AbstractProgressButtonDirective } from './abstract.progress.button.directive';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';
import { type Maybe, spaceSeparatedCssClasses } from '@dereekb/util';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgClass, NgStyle, NgTemplateOutlet } from '@angular/common';

/**
 * Progress button that overlays a Material progress spinner on the button while working.
 * Supports icon-only, FAB, extended FAB, and text button modes with automatic spinner sizing.
 *
 * A `fab` config renders a Material `mat-fab` — an extended FAB when the button has text — while `fab` + `iconOnly` renders a
 * round icon button.
 *
 * @dbxWebComponent
 * @dbxWebSlug progress-spinner-button
 * @dbxWebCategory button
 * @dbxWebRelated button, progress-bar-button
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-progress-spinner-button [config]="cfg"></dbx-progress-spinner-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-progress-spinner-button [config]="cfg" (btnClick)="onClick()"></dbx-progress-spinner-button>
 * ```
 */
@Component({
  selector: 'dbx-progress-spinner-button,dbx-spinner-button',
  templateUrl: './spinner.button.component.html',
  styleUrls: ['./spinner.button.component.scss', './shared.button.component.scss'],
  imports: [MatButtonModule, MatIconModule, MatProgressSpinner, NgClass, NgStyle, NgTemplateOutlet]
})
export class DbxProgressSpinnerButtonComponent extends AbstractProgressButtonDirective {
  readonly buttonRef = viewChild.required<string, ElementRef<HTMLElement>>('button', { read: ElementRef<HTMLElement> });

  /**
   * Whether the button renders as a Material FAB (`mat-fab`). Set by `fab` without `iconOnly`; an `iconOnly` + `fab` button keeps the
   * round icon-button presentation.
   */
  readonly isFabSignal = computed(() => {
    const config = this.configSignal();
    return Boolean(config?.fab && !config.iconOnly);
  });

  /**
   * Whether a FAB renders as an extended FAB (icon + label) because it has text content.
   */
  readonly isExtendedFabSignal = computed(() => {
    const config = this.configSignal();
    return this.isFabSignal() && (config?.hasTextContent ?? Boolean(config?.text));
  });

  readonly buttonCssArraySignal = computed(() => {
    const config = this.configSignal();
    // A FAB takes its presentation from mat-fab, so the mat-button variant classes are left off.
    const classes = this.isFabSignal() ? [...this.commonCssClassSignal()] : [...this.baseCssClassSignal()];

    if (config?.fab) {
      classes.push('dbx-progress-spinner-fab');
    }

    return classes;
  });

  readonly buttonCss$ = toObservable(this.buttonCssArraySignal).pipe(map(spaceSeparatedCssClasses), distinctUntilChanged(), shareReplay(1));

  readonly spinnerSizeSignal = computed(() => {
    const config = this.configSignal();
    const buttonRef = this.buttonRef();

    const elem = buttonRef.nativeElement;
    const height = elem.clientHeight;

    let size: Maybe<number>;

    if (config != null) {
      if (config.iconOnly) {
        if (config.fab) {
          size = 48;
        } else {
          size = height;
        }
      } else {
        size = config.spinnerSize;
      }
    }

    if (!size) {
      const minimumSpinnerSize = 24;
      const spinnerRatio = config?.spinnerRatio ?? 0.33;
      const targetSpinnerSize = height * Math.min(1, spinnerRatio);
      size = Math.min(height, Math.max(minimumSpinnerSize, targetSpinnerSize));
    }

    return size;
  });

  readonly buttonCssSignal = toSignal(this.buttonCss$);

  readonly showTextContentSignal = computed(() => {
    const isExtendedFab = this.isExtendedFabSignal();
    const config = this.configSignal();
    // Hide text area for FAB, icon-only, or when an icon is present with no text content.
    // Do not hide when there is no icon, as projected content (ng-content) may be present
    // even when hasTextContent is false (e.g. dynamically created components where
    // projected content detection at constructor time is unreliable).
    // An extended FAB shows its text; a regular FAB only shows its icon.
    const isIconWithNoTextContent = config?.hasTextContent === false && config?.buttonIcon;
    const isHiddenByFab = config?.fab && !isExtendedFab;
    return !isHiddenByFab && !config?.iconOnly && !isIconWithNoTextContent;
  });

  readonly showTextButtonIconSignal = computed(() => {
    const config = this.configSignal();
    const showText = this.showTextContentSignal();
    return showText && config?.buttonIcon; // shows the button icon with showing the text.
  });

  readonly showIconSignal = computed(() => {
    const showTextContent = this.showTextContentSignal();
    const config = this.configSignal();
    return (
      config?.buttonIcon && !showTextContent // button icon must be defined
    ); // show icon if either fab or iconOnly is true
  });

  readonly customSpinnerStyleSignal = computed(() => {
    const customSpinnerColor = this.configSignal()?.customSpinnerColor;
    return customSpinnerColor ? { '--mat-progress-spinner-active-indicator-color': customSpinnerColor } : undefined;
  });

  readonly customSpinnerStyleClassSignal = computed(() => {
    const hasCustomStyle = Boolean(this.customSpinnerStyleSignal());
    return hasCustomStyle ? { 'dbx-progress-spinner-custom': true } : undefined;
  });
}
