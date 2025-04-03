import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxPartialPresetFilterMenuDirective } from './filter.partial';
import { DbxAnchorListComponent } from '../../router/layout/anchorlist/anchorlist.component';

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
