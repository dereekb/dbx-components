import { Component } from '@angular/core';

/**
 * Section used to elevate content in a pre-configured manner.
 */
@Component({
  selector: 'dbx-content-elevate',
  template: `
  <div class="dbx-content-elevate">
    <ng-content></ng-content>
  </div>
  `
})
export class DbxContentElevateComponent { }
