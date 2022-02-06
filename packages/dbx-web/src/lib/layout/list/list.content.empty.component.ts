import { Component, Input } from '@angular/core';

/**
 * Component that is centered for use within an empty list.
 */
@Component({
  selector: 'dbx-list-empty-content',
  template: `
    <div class="dbx-list-empty-content">
      <ng-content></ng-content>
    </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbxListEmptyContentComponent { }
