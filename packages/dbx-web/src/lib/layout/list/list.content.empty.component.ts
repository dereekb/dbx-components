import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Displays centered placeholder content within an empty list. Projects its content into a styled container.
 *
 * @example
 * ```html
 * <dbx-list-empty-content>
 *   <p>No results found.</p>
 * </dbx-list-empty-content>
 * ```
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
