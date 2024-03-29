import { Component } from '@angular/core';
import { FilterWithPreset } from '@dereekb/rxjs';
import { AbstractDbxPresetFilterMenuComponent } from './filter.preset';

@Component({
  selector: 'dbx-preset-filter-list',
  template: `
    <dbx-anchor-list [anchors]="presetAnchors$ | async"></dbx-anchor-list>
  `
})
export class DbxPresetFilterListComponent<F extends FilterWithPreset> extends AbstractDbxPresetFilterMenuComponent<F> {}
