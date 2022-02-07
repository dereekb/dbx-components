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

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DocInteractionLayoutComponent,
    DocInteractionHomeComponent,
    DocInteractionDialogComponent,
    DocInteractionPopupComponent,
    DocInteractionPopoverComponent,
    DocInteractionPromptComponent
  ],
})
export class DocInteractionModule { }
