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
import { DocInteractionTestFilterCustomFilterFormComponent } from './component/filter.custom.form.component';
import { DocInteractionTestFilterPresetFilterFormComponent } from './component/filter.preset.form.component';

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
    DocInteractionTestFilterPresetFilterComponent,
    DocInteractionTestFilterCustomFilterFormComponent,
    DocInteractionTestFilterPresetFilterFormComponent,
    // container
    DocInteractionLayoutComponent,
    DocInteractionHomeComponent,
    DocInteractionDialogComponent,
    DocInteractionFilterComponent,
    DocInteractionPopupComponent,
    DocInteractionPopoverComponent,
    DocInteractionPromptComponent
  ],
})
export class DocInteractionModule { }
