import { Component } from '@angular/core';
import { AbstractDbxPartialPresetFilterMenuDirective } from './filter.partial';

@Component({
  selector: 'dbx-preset-partial-filter-list',
  template: `
    <dbx-anchor-list [anchors]="presetAnchors$ | async"></dbx-anchor-list>
  `
})
export class DbxPartialPresetFilterListComponent<F> extends AbstractDbxPartialPresetFilterMenuDirective<F> {}
