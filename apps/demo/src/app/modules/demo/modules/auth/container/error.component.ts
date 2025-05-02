import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { UISref } from '@uirouter/angular';

@Component({
    template: `
    <div class="dbx-hint">An error occured while logging in.</div>
    <button mat-stroked-button uiSref="demo.auth.login">Log In</button>
  `,
    standalone: true,
    imports: [MatButton, UISref]
})
export class DemoAuthErrorComponent {}
