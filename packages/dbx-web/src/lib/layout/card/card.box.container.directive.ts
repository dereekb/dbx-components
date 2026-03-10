import { Directive } from '@angular/core';

/**
 * Adds content padding around a card box section.
 *
 * Can be used as an element or as an attribute directive on any host element.
 *
 * @example
 * ```html
 * <dbx-card-box-container>
 *   <p>Padded content inside the card box.</p>
 * </dbx-card-box-container>
 * ```
 *
 * @example
 * ```html
 * <div dbxCardBoxContainer>
 *   <p>Padded content using the attribute directive.</p>
 * </div>
 * ```
 */
@Directive({
  selector: 'dbx-card-box-container, [dbxCardBoxContainer]',
  host: {
    class: 'd-block dbx-card-box-container'
  },
  standalone: true
})
export class DbxCardBoxContainerDirective {}
