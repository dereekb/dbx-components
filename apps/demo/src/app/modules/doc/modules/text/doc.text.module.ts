import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.text.router';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocTextHomeComponent } from './container/home.component';
import { DocTextLayoutComponent } from './container/layout.component';
import { DocTextTextComponent } from './container/text.component';
import { DocTextPipesComponent } from './container/pipes.component';
import { DocFormComponentsModule } from '../form/doc.form.module';

@NgModule({
    imports: [
        DocSharedModule,
        DocFormComponentsModule,
        UIRouterModule.forChild({
            states: STATES
        }),
        //
        DocTextHomeComponent,
        DocTextLayoutComponent,
        DocTextTextComponent,
        DocTextPipesComponent
    ]
})
export class DocTextModule {}
