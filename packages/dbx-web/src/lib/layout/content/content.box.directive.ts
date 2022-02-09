import { Directive, Input } from '@angular/core';

/**
 * Component used to wrap content in a box with optionally elevation.
 */
@Directive({
  selector: 'dbx-content-box, [dbx-content-box]',
  host: {
    'class': 'd-block dbx-content-box',
    '[class.dbx-content-elevate]': 'elevated'
  }
})
export class DbxContentBoxDirective {

  @Input()
  elevated = true;

}
