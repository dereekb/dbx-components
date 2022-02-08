import { DocFormDateComponent } from './container/date.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocFormHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocFormBooleanComponent } from './container/boolean.component';
import { DocFormWrapperComponent } from './container/wrapper.component';
import { DocFormTextEditorComponent } from './container/texteditor.component';
import { DocFormTextComponent } from './container/text.component';
import { DocFormPhoneComponent } from './container/phone.component';
import { DocFormGenericComponent } from './container/generic.component';
import { DocFormComponentComponent } from './container/component.component';
import { DocFormChecklistComponent } from './container/checklist.component';
import { DocFormLayoutComponent } from './container/layout.component';
import { STATES } from './doc.form.router';

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DocFormLayoutComponent,
    DocFormHomeComponent,
    DocFormBooleanComponent,
    DocFormChecklistComponent,
    DocFormDateComponent,
    DocFormComponentComponent,
    DocFormGenericComponent,
    DocFormPhoneComponent,
    DocFormTextComponent,
    DocFormTextEditorComponent,
    DocFormWrapperComponent
  ],
})
export class DocFormModule { }
