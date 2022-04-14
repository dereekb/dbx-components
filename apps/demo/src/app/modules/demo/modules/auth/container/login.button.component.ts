import { Component } from '@angular/core';

@Component({
  template: `
  <button mat-stroked-button (click)="login()">Log In</button>
  `
})
export class DemoAuthLoginButtonComponent {

  login(): void {
    // todo
  }

}
