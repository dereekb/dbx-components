import { Component, Input, ViewEncapsulation } from '@angular/core';

/**
 * Section used to wrap content in a border with internal padding.
 */
@Component({
  selector: 'dbx-content-border',
  template: `
  <div class="dbx-content-border">
    <ng-content></ng-content>
  </div>
  `,
  styleUrls: ['./content.border.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DbxContentBorderComponent { }
