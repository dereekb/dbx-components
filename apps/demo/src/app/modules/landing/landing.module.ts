import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './landing.router';
import { DemoRootSharedModule } from 'demo-components';
import { LandingLayoutComponent } from './container/layout.component';

@NgModule({
    imports: [
        DemoRootSharedModule,
        UIRouterModule.forChild({
            states: STATES
        }),
        LandingLayoutComponent
    ]
})
export class LandingModule {}
