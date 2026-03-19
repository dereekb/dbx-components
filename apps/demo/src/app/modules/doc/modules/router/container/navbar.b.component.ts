import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'doc-router-navbar-b',
  template: `
    <div>
      <p>Page B</p>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocRouterNavbarBComponent {}
