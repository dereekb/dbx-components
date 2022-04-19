import { Component } from '@angular/core';

@Component({
  template: `
  <dbx-hint>An error occured while logging in.</dbx-hint>
  <button mat-stroked-button uiSref="demo.auth.login">Log In</button>
  `
})
export class DemoAuthErrorComponent { }
