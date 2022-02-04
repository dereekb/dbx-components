import { Component, Input } from '@angular/core';

/**
 * Component used to wrap contental content on an optionally elevated box.
 */
@Component({
  selector: 'dbx-content-box',
  template: `
  <div class="dbx-content-box" [ngClass]="(elevated) ? 'dbx-content-elevate' : ''">
    <ng-content></ng-content>
  </div>
  `
})
export class DbxContentBoxComponent {

  @Input()
  elevated = true;

}
