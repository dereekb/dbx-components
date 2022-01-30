import { AppLayoutComponent } from './container/layout.component';
import { Injector, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { Category, StatesModule, UIRouter, UIRouterModule, UIView } from '@uirouter/angular';
import { AppSharedModule } from '@/shared/app.shared.module';
import { ROOT_STATES } from './app.router';
import { environment } from '../environments/environment';

export function routerConfigFn(router: UIRouter, injector: Injector, module: StatesModule): any {
  const transitionService = router.transitionService;

  transitionService.onSuccess({}, () => {
    // Send a page view on each successful transition.
    // service.sendPageView();
  });

  // In testing, print transitions.
  if (!environment.production) {
    // router.trace.enable(Category.RESOLVE);
    // router.trace.enable(Category.HOOK);
    router.trace.enable(Category.TRANSITION);
    // router.trace.enable(Category.UIVIEW);
    // router.trace.enable(Category.VIEWCONFIG);
  }

  return undefined;
}

@NgModule({
  imports: [
    BrowserModule,
    AppSharedModule,
    UIRouterModule.forRoot({
      states: ROOT_STATES,
      useHash: false,
      initial: { state: 'public.landing' },
      otherwise: { state: 'public.landing' },
      config: routerConfigFn
    }),
  ],
  providers: [],
  declarations: [AppLayoutComponent],
  bootstrap: [UIView]
})
export class AppModule { }
