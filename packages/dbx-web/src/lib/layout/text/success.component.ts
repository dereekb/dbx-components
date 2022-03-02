import { Component } from '@angular/core';

@Component({
  selector: 'dbx-success',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'dbx-success'
  }
})
export class DbxSuccessComponent { }
