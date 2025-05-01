import { DocHomeComponent } from './container/home.component';
import { DocLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.router';
import { DemoRootSharedModule } from 'demo-components';
import { DocSharedModule } from './modules/shared/doc.shared.module';

@NgModule({
    imports: [
        DemoRootSharedModule,
        DocSharedModule,
        UIRouterModule.forChild({
            states: STATES
        }),
        DocHomeComponent, DocLayoutComponent
    ]
})
export class DocModule {}
