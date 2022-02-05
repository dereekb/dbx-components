import { Component } from '@angular/core';

/**
 * Section used to wrap content in a border with internal padding.
 */
@Component({
  selector: 'dbx-content-border',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'd-block dbx-content-border'
  }
})
export class DbxContentBorderComponent { }
