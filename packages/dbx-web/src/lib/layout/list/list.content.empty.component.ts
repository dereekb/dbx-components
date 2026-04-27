import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Displays centered placeholder content within an empty list. Projects its content into a styled container.
 *
 * @dbxWebComponent
 * @dbxWebSlug list-empty-content
 * @dbxWebCategory list
 * @dbxWebRelated list
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <dbx-list-empty-content>Empty</dbx-list-empty-content>
 * ```
 *
 * @example
 * ```html
 * <dbx-list [state$]="items$" [config]="listConfig">
 *   <dbx-list-empty-content>
 *     <p>No items yet — add one to get started.</p>
 *   </dbx-list-empty-content>
 * </dbx-list>
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
