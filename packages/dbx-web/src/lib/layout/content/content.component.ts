import { Component, Input } from '@angular/core';

/**
 * Component that sets the height of it's content to fill the page with respect to the top two navigation bars.
 */
@Component({
  selector: 'dbx-content',
  template: `
    <div class="dbx-content" [ngClass]="{ 'has-second-bar': hasSecondBar }">
      <ng-content></ng-content>
    </div>
  `,
  // TODO: styleUrls: ['./container.scss']
})
export class DbxContentComponent {

  @Input()
  hasSecondBar = true;

}
