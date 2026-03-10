import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxPartialPresetFilterMenuDirective } from './filter.partial';
import { DbxAnchorListComponent } from '../../router/layout/anchorlist/anchorlist.component';

/**
 * Displays partial filter presets as a clickable anchor list.
 *
 * @example
 * ```html
 * <dbx-preset-partial-filter-list [partialPresets]="myPartialPresets"></dbx-preset-partial-filter-list>
 * ```
 */
@Component({
  selector: 'dbx-preset-partial-filter-list',
  template: `
    <dbx-anchor-list [anchors]="presetAnchorsSignal()"></dbx-anchor-list>
  `,
  imports: [DbxAnchorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPartialPresetFilterListComponent<F> extends AbstractDbxPartialPresetFilterMenuDirective<F> {}
