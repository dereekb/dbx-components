import { Component, Input } from '@angular/core';

/**
 * Component used to elevate content.
 */
@Component({
  selector: 'dbx-section-elevated',
  template: `
  <div class="dbx-section-elevated">
    <ng-content></ng-content>
  </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbNgxSectionElevatedComponent { }
