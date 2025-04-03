import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FilterWithPreset } from '@dereekb/rxjs';
import { AbstractDbxPresetFilterMenuDirective } from './filter.preset.directive';
import { DbxAnchorListComponent } from '../../router/layout/anchorlist/anchorlist.component';

@Component({
  selector: 'dbx-preset-filter-list',
  template: `
    <dbx-anchor-list [anchors]="presetAnchorsSignal()"></dbx-anchor-list>
  `,
  imports: [DbxAnchorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPresetFilterListComponent<F extends FilterWithPreset> extends AbstractDbxPresetFilterMenuDirective<F> {}
