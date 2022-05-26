import { Component } from '@angular/core';

@Component({
  template: `
    <dbx-hint>You have been logged out.</dbx-hint>
    <div>
      <a mat-stroked-button uiSref="demo.auth.login">Log In</a>
      <dbx-button-spacer></dbx-button-spacer>
      <a mat-stroked-button uiSref="demo.home">Home</a>
    </div>
  `
})
export class DemoAuthLoggedOutComponent {}
