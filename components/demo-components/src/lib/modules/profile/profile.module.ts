import { DemoProfileUsernameFormComponent } from './component/profile.username.form.component';
import { NgModule } from '@angular/core';
import { DemoProfileDocumentStoreDirective } from './store/profile.document.store.directive';
import { DemoProfileFormComponent } from './component/profile.form.component';
import { DemoRootSharedModule } from '../../root.shared.module';

@NgModule({
  imports: [
    DemoRootSharedModule
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
