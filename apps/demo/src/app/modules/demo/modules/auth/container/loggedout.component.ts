import { Component } from '@angular/core';

@Component({
  template: `
    <div class="dbx-hint">You have been logged out.</div>
    <div>
      <a mat-stroked-button uiSref="demo.auth.login">Log In</a>
      <dbx-button-spacer></dbx-button-spacer>
      <a mat-stroked-button uiSref="demo.home">Home</a>
    </div>
  `
})
export class DemoAuthLoggedOutComponent {}
