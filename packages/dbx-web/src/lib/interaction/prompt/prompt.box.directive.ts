import { Directive, input } from '@angular/core';

/**
 * Applies prompt box styling with optional elevation to its host element.
 *
 * @example
 * ```html
 * <dbx-prompt-box [elevate]="true">
 *   <dbx-prompt [header]="'Sign In'"></dbx-prompt>
 * </dbx-prompt-box>
 * ```
 */
@Directive({
  selector: 'dbx-prompt-box, [dbxPromptBox]',
  host: {
    class: 'd-block dbx-prompt-box',
    '[class.elevate]': 'elevate()'
  },
  standalone: true
})
export class DbxPromptBoxDirective {
  readonly elevate = input<boolean>(true);
}
