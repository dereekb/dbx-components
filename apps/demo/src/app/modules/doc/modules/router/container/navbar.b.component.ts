import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'doc-router-navbar-b',
  template: `
    <div>
      <p>Page B</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocRouterNavbarBComponent {}
