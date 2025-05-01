import { DemoProfileUsernameFormComponent } from './component/profile.username.form.component';
import { NgModule } from '@angular/core';
import { DemoProfileDocumentStoreDirective } from './store/profile.document.store.directive';
import { DemoProfileFormComponent } from './component/profile.form.component';

@NgModule({
  imports: [],
  declarations: [DemoProfileFormComponent, DemoProfileUsernameFormComponent, DemoProfileDocumentStoreDirective],
  exports: [DemoProfileFormComponent, DemoProfileUsernameFormComponent, DemoProfileDocumentStoreDirective]
})
export class DemoSharedProfileModule {}
