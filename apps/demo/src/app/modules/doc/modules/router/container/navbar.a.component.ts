import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'doc-router-navbar-a',
  template: `
    <div>
      <p>Page A</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocRouterNavbarAComponent {}
