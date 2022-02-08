import { Component, Input } from '@angular/core';

/**
 * Component that sets the height of it's content to fill the page.
 */
@Component({
  selector: 'dbx-content',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'd-block dbx-content'
  }
})
export class DbxContentComponent { }
