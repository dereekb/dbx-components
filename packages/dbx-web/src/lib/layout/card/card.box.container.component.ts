import { Component } from '@angular/core';

/**
 * Component that wraps a card box and adds content padding.
 */
@Component({
  selector: 'dbx-card-box-container',
  template: `
    <div class="dbx-card-box-container">
      <ng-content></ng-content>
    </div>
  `
})
export class DbxCardBoxContainerComponent {}
