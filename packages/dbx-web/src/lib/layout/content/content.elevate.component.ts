import { Component } from '@angular/core';

/**
 * Section used to elevate content in a pre-configured manner.
 */
@Component({
  selector: 'dbx-content-elevate',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'd-block dbx-content-elevate'
  }
})
export class DbxContentElevateComponent { }
