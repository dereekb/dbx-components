import { Component, OnInit } from '@angular/core';
import { ClickableFilterPreset, AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DbxPresetFilterMenuConfig } from '@dereekb/dbx-web';
import { DocInteractionTestFilter, DOC_INTERACTION_TEST_PRESETS } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-preset-menu',
  template: '<dbx-preset-filter-menu [config]="menuConfig" [presets]="presets"></dbx-preset-filter-menu>',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterPresetMenuComponent)]
})
export class DocInteractionTestFilterPresetMenuComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> implements OnInit {
  readonly menuConfig: DbxPresetFilterMenuConfig = {
    usePresetIcon: true
  };

  readonly presets: ClickableFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_TEST_PRESETS;

  override ngOnInit(): void {
    super.ngOnInit();
    this.initialFilterTakesPriority = true;
  }
}
