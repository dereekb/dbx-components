import { Component, Input } from '@angular/core';

/**
 * Component that is wrapped with a padded border.
 */
@Component({
  selector: 'dbx-bordered-content',
  template: `
    <div class="dbx-bordered-content">
      <ng-content></ng-content>
    </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbNgxBorderedContentComponent { }
