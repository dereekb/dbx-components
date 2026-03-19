import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AbstractFilterSourceDirective, provideFilterSourceDirective, type ClickablePartialFilterPreset } from '@dereekb/dbx-core';
import { type DbxPresetFilterMenuConfig, DbxPartialPresetFilterMenuComponent } from '@dereekb/dbx-web';
import { type DocInteractionTestFilter, DOC_INTERACTION_TEST_PARTIAL_PRESETS } from './filter';

@Component({
  selector: 'doc-interaction-test-filter-partial-preset-menu',
  template: '<dbx-partial-preset-filter-menu [config]="menuConfig" [partialPresets]="partialPresets"></dbx-partial-preset-filter-menu>',
  providers: [provideFilterSourceDirective(DocInteractionTestFilterPartialPresetMenuComponent)],
  standalone: true,
  imports: [DbxPartialPresetFilterMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionTestFilterPartialPresetMenuComponent extends AbstractFilterSourceDirective<DocInteractionTestFilter> implements OnInit {
  readonly menuConfig: DbxPresetFilterMenuConfig = {
    usePresetIcon: true
  };

  readonly partialPresets: ClickablePartialFilterPreset<DocInteractionTestFilter>[] = DOC_INTERACTION_TEST_PARTIAL_PRESETS;

  ngOnInit(): void {
    this.setInitialFilterTakesPriority(true);
  }
}
