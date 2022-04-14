import { Component } from '@angular/core';

@Component({
  selector: 'demo-login-view',
  template: `
  <div>
    <button mat-stroked-button (click)="login()">Log In</button>
    <dbx-button-spacer></dbx-button-spacer>
    <button mat-stroked-button (click)="login()">Register</button>
  </div>
  `
})
export class DemoAuthLoginViewComponent {

  login(): void {
    // todo
  }

}
