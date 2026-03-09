import { Component, type OnInit } from '@angular/core';
import { type ClickableFilterPreset, AbstractFilterSourceDirective, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { type DbxPresetFilterMenuConfig, DbxPresetFilterMenuComponent } from '@dereekb/dbx-web';
import { type DocInteractionTestFilter, DOC_INTERACTION_TEST_PRESETS } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-preset-menu',
  template: '<dbx-preset-filter-menu [config]="menuConfig" [presets]="presets"></dbx-preset-filter-menu>',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterPresetMenuComponent)],
  standalone: true,
  imports: [DbxPresetFilterMenuComponent]
})
export class DocInteractionTestFilterPresetMenuComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> implements OnInit {
  readonly menuConfig: DbxPresetFilterMenuConfig = {
    usePresetIcon: true
  };

  readonly presets: ClickableFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_TEST_PRESETS;

  ngOnInit(): void {
    this.setInitialFilterTakesPriority(true);
  }
}
