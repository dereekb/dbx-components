import { DemoProfileUsernameFormComponent } from './component/profile.username.form.component';
import { NgModule } from '@angular/core';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DemoProfileDocumentStoreDirective } from './store/profile.document.store.directive';
import { DemoProfileFormComponent } from './component/profile.form.component';

@NgModule({
  imports: [
    AppSharedModule
  ],
  declarations: [
    DemoProfileFormComponent,
    DemoProfileUsernameFormComponent,
    DemoProfileDocumentStoreDirective
  ],
  exports: [
    DemoProfileFormComponent,
    DemoProfileUsernameFormComponent,
    DemoProfileDocumentStoreDirective
  ]
})
export class DemoSharedProfileModule { }
