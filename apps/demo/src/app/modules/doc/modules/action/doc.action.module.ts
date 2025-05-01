import { DocActionInteractionComponent } from './container/interaction.component';
import { DocActionDirectivesComponent } from './container/directives.component';
import { DocActionFormComponent } from './container/form.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocActionHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocActionLayoutComponent } from './container/layout.component';
import { STATES } from './doc.action.router';
import { DocActionContextComponent } from './container/context.component';
import { DocActionExampleToolsComponent } from './component/action.example.tool.component';
import { DocActionFormExampleFormComponent } from './component/action.example.form.component';
import { DocActionMapComponent } from './container/map.component';
import { DocActionExamplePopoverComponent } from './component/action.example.popover.component';
import { DocActionExampleDialogComponent } from './component/action.example.dialog.component';
import { DocActionFormExampleFormTwoComponent } from './component/action.example.form.two.component';

@NgModule({
    imports: [
        DocSharedModule,
        UIRouterModule.forChild({
            states: STATES
        }),
        // component
        DocActionExampleToolsComponent,
        DocActionFormExampleFormComponent,
        DocActionFormExampleFormTwoComponent,
        DocActionExampleDialogComponent,
        DocActionExamplePopoverComponent,
        // container
        DocActionLayoutComponent,
        DocActionHomeComponent,
        DocActionContextComponent,
        DocActionInteractionComponent,
        DocActionFormComponent,
        DocActionDirectivesComponent,
        DocActionMapComponent
    ]
})
export class DocActionModule {}
