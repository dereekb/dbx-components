import { Component, Input } from '@angular/core';

/**
 * Component that sets the height of it's content to fill the page.
 */
@Component({
  selector: 'dbx-content',
  template: `
    <div class="dbx-content">
      <ng-content></ng-content>
    </div>
  `
})
export class DbxContentComponent { }
