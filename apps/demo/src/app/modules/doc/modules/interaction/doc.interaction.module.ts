import { CUSTOM_ERROR_WIDGET_TEST_ERROR_CODE, DocInteractionCustomErrorWidgetComponent } from './component/error.custom.widget.component';
import { DocInteractionExamplePopupContentComponent } from './component/interaction.popup.content.component';
import { DocInteractionExamplePopupComponent } from './component/interaction.popup.component';
import { DocInteractionTestFilterPresetFilterComponent } from './component/filter.preset.component';
import { DocInteractionTestFilterCustomFilterComponent } from './component/filter.custom.component';
import { DocInteractionPromptComponent } from './container/prompt.component';
import { DocInteractionPopoverComponent } from './container/popover.component';
import { DocInteractionPopupComponent } from './container/popup.component';
import { DocInteractionLayoutComponent } from './container/layout.component';
import { NgModule, inject } from '@angular/core';
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
import { CUSTOM_DBX_ERROR_TEST_ERROR_CODE, DocInteractionCustomInlineErrorWidgetComponent } from './component/error.custom.inline.widget.component';

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
    DocInteractionCustomInlineErrorWidgetComponent,
    DocInteractionCustomErrorWidgetComponent,
    // container
    DocInteractionLayoutComponent,
    DocInteractionHomeComponent,
    // DocInteractionLoadingComponent,    // standalone
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
  readonly dbxErrorWidgetService = inject(DbxErrorWidgetService);

  constructor() {
    this.dbxErrorWidgetService.register({
      code: CUSTOM_ERROR_WIDGET_TEST_ERROR_CODE,
      widgetComponentClass: DocInteractionCustomErrorWidgetComponent
    });

    this.dbxErrorWidgetService.register({
      code: CUSTOM_DBX_ERROR_TEST_ERROR_CODE,
      errorComponentClass: DocInteractionCustomInlineErrorWidgetComponent
    });
  }
}
