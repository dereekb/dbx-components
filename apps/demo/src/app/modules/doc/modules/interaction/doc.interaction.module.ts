import { CUSTOM_TEST_ERROR_CODE, DocInteractionCustomErrorWidgetComponent } from './component/error.widget.component';
import { DocInteractionExamplePopupContentComponent } from './component/interaction.popup.content.component';
import { DocInteractionExamplePopupComponent } from './component/interaction.popup.component';
import { DocInteractionTestFilterPresetFilterComponent } from './component/filter.preset.component';
import { DocInteractionTestFilterCustomFilterComponent } from './component/filter.custom.component';
import { DocInteractionPromptComponent } from './container/prompt.component';
import { DocInteractionPopoverComponent } from './container/popover.component';
import { DocInteractionPopupComponent } from './container/popup.component';
import { DocInteractionLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocInteractionHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocInteractionDialogComponent } from './container/dialog.component';
import { STATES } from './doc.interaction.router';
import { DocInteractionFilterComponent } from './container/filter.component';
import { DocInteractionTestFilterPopoverButtonComponent } from './component/filter.popover.button.component';
import { DocInteractionTestDateFilterFormComponent } from './component/filter.date.form.component';
import { DocInteractionExampleDialogComponent } from './component/interaction.dialog.component';
import { DocInteractionExamplePopoverComponent } from './component/interaction.popover.component';
import { DocInteractionExamplePopoverContentComponent } from './component/interaction.popover.content.component';
import { DocInteractionButtonComponent } from './container/button.component';
import { DocInteractionTestFilterPresetMenuComponent } from './component/filter.preset.menu.component';
import { DocInteractionErrorComponent } from './container/error.component';
import { DbxErrorWidgetService } from '@dereekb/dbx-web';
import { DocInteractionTestFilterPartialPresetMenuComponent } from './component/filter.partial.preset.menu.component';
import { DocInteractionTestDateFilterPopoverButtonComponent } from './component/filter.date.popover.button.component';
import { DocInteractionTestDateFilterPresetFilterComponent } from './component/filter.date.preset.component';
import { DocInteractionTestFilterCustomFilterFormComponent } from './component/filter.custom.form.component';
import { DocInteractionLoadingComponent } from './container/loading.component';

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // components
    DocInteractionTestFilterPopoverButtonComponent,
    DocInteractionTestFilterCustomFilterComponent,
    DocInteractionTestDateFilterFormComponent,
    DocInteractionTestDateFilterPopoverButtonComponent,
    DocInteractionTestDateFilterPresetFilterComponent,
    DocInteractionTestFilterPresetFilterComponent,
    DocInteractionTestFilterPresetMenuComponent,
    DocInteractionTestFilterPartialPresetMenuComponent,
    DocInteractionTestFilterCustomFilterFormComponent,
    DocInteractionExampleDialogComponent,
    DocInteractionExamplePopoverComponent,
    DocInteractionExamplePopoverContentComponent,
    DocInteractionExamplePopupComponent,
    DocInteractionExamplePopupContentComponent,
    DocInteractionCustomErrorWidgetComponent,
    // container
    DocInteractionLayoutComponent,
    DocInteractionHomeComponent,
    DocInteractionLoadingComponent,
    DocInteractionButtonComponent,
    DocInteractionErrorComponent,
    DocInteractionDialogComponent,
    DocInteractionFilterComponent,
    DocInteractionPopupComponent,
    DocInteractionPopoverComponent,
    DocInteractionPromptComponent
  ]
})
export class DocInteractionModule {
  constructor(readonly dbxErrorWidgetService: DbxErrorWidgetService) {
    this.dbxErrorWidgetService.register({
      code: CUSTOM_TEST_ERROR_CODE,
      componentClass: DocInteractionCustomErrorWidgetComponent
    });
  }
}
