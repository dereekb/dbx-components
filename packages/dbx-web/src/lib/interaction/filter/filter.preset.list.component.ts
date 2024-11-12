import { Component } from '@angular/core';
import { FilterWithPreset } from '@dereekb/rxjs';
import { AbstractDbxPresetFilterMenuDirective } from './filter.preset.directive';

@Component({
  selector: 'dbx-preset-filter-list',
  template: `
    <dbx-anchor-list [anchors]="presetAnchors$ | async"></dbx-anchor-list>
  `
})
export class DbxPresetFilterListComponent<F extends FilterWithPreset> extends AbstractDbxPresetFilterMenuDirective<F> {}
