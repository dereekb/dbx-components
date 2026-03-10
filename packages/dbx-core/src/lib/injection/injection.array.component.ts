import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { type DbxInjectionArrayEntry } from './injection.array';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponent } from './injection.component';

/**
 * Renders a list of dynamically injected components from an array of {@link DbxInjectionArrayEntry} items.
 *
 * Each entry is tracked by its `key` property for efficient change detection, and rendered
 * using a nested {@link DbxInjectionComponent}.
 *
 * @example
 * ```html
 * <dbx-injection-array [entries]="myEntries" />
 * ```
 *
 * @example
 * ```typescript
 * // In the host component:
 * myEntries: DbxInjectionArrayEntry[] = [
 *   { key: 'chart', injectionConfig: { componentClass: ChartComponent } },
 *   { key: 'table', injectionConfig: { componentClass: TableComponent } }
 * ];
 * ```
 *
 * @see {@link DbxInjectionArrayEntry}
 * @see {@link DbxInjectionComponent}
 */
@Component({
  selector: 'dbx-injection-array',
  template: `
    @for (entry of entries(); track entry.key) {
      <dbx-injection [config]="entry.injectionConfig"></dbx-injection>
    }
  `,
  imports: [DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxInjectionArrayComponent {
  /**
   * The array of keyed injection entries to render. Each entry produces a `<dbx-injection>` component.
   */
  readonly entries = input<Maybe<DbxInjectionArrayEntry[]>>(undefined);
}
