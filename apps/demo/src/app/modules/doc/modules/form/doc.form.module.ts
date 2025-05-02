import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocFormHomeComponent } from './container/home.component';

import { DocFormWrapperComponent } from './container/wrapper.component';
import { DocFormTextEditorComponent } from './container/texteditor.component';
import { DocFormSelectionComponent } from './container/selection.component';
import { DocFormComponentComponent } from './container/component.component';
import { DocFormChecklistComponent } from './container/checklist.component';
import { DocFormLayoutComponent } from './container/layout.component';
import { STATES } from './doc.form.router';
import { DocFormValueComponent } from './container/value.component';
import { DocFormTemplateComponent } from './container/template.component';
import { DocFormDirectiveComponent } from './container/directive.component';
import { FormlyMatNativeSelectModule } from '@ngx-formly/material/native-select';
import { DocFormExpressionComponent } from './container/expression.component';

import { DocFormFormComponent } from './container/form.component';
import { DocFormDateValueComponent } from './container/value.date.component';

@NgModule({
  imports: [
    FormlyMatNativeSelectModule,
    UIRouterModule.forChild({
      states: STATES
    }),
    // container
    DocFormLayoutComponent,
    DocFormHomeComponent,
    DocFormChecklistComponent,
    DocFormValueComponent,
    DocFormDateValueComponent,
    DocFormSelectionComponent,
    DocFormExpressionComponent,
    DocFormFormComponent,
    DocFormComponentComponent,
    DocFormDirectiveComponent,
    DocFormTextEditorComponent,
    DocFormTemplateComponent,
    DocFormWrapperComponent,
    DocFormFormComponent
  ]
})
export class DocFormModule {}
