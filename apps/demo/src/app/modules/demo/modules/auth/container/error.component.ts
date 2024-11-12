import { Component } from '@angular/core';

@Component({
  template: `
    <div class="dbx-hint">An error occured while logging in.</div>
    <button mat-stroked-button uiSref="demo.auth.login">Log In</button>
  `
})
export class DemoAuthErrorComponent {}
