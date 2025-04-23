import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Component that is centered for use within an empty list.
 */
@Component({
  selector: 'dbx-list-empty-content',
  template: `
    <div class="dbx-list-empty-content">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxListEmptyContentComponent {}
