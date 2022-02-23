import { Component } from '@angular/core';

@Component({
  selector: 'dbx-hint',
  template: `<ng-content></ng-content>`,
  host: {
    'class': 'dbx-hint'
  }
})
export class DbxHintComponent { }
