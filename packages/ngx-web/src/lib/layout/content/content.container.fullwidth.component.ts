import { Component, Input } from '@angular/core';

/**
 * Component that extends the entire width and has padding.
 */
@Component({
  selector: 'dbx-full-width-content-container',
  template: `
    <div class="dbx-full-width-content-container">
      <ng-content></ng-content>
    </div>
  `,
  styleUrls: ['./container.scss']
})
export class DbNgxFullWidthContentContainerComponent { }
