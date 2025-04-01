import { Component } from '@angular/core';
import { UIView } from '@uirouter/angular';

@Component({
  selector: 'app-root',
  template: `
    <ui-view id="default"></ui-view>
  `,
  styles: [
    `
      .app {
        text-align: center;
        border: 1px solid;
      }
      .active {
        font-weight: bold;
      }
    `
  ],
  standalone: true,
  imports: [UIView]
})
export class AppComponent {}
