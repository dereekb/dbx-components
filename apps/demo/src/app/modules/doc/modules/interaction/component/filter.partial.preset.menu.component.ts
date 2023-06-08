import { Component, OnInit } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective, ClickablePartialFilterPreset } from '@dereekb/dbx-core';
import { DbxPresetFilterMenuConfig } from '@dereekb/dbx-web';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_PARTIAL_PRESETS } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-partial-preset-menu',
  template: '<dbx-partial-preset-filter-menu [config]="menuConfig" [partialPresets]="partialPresets"></dbx-partial-preset-filter-menu>',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterPartialPresetMenuComponent)]
})
export class DocInteractionTestFilterPartialPresetMenuComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> implements OnInit {
  readonly menuConfig: DbxPresetFilterMenuConfig = {
    usePresetIcon: true
  };

  readonly partialPresets: ClickablePartialFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_TEST_PARTIAL_PRESETS;

  override ngOnInit(): void {
    super.ngOnInit();
    this.initialFilterTakesPriority = true;
  }
}
