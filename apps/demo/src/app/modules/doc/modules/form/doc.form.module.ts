import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocFormHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocFormWrapperComponent } from './container/wrapper.component';
import { DocFormTextEditorComponent } from './container/texteditor.component';
import { DocFormSelectionComponent } from './container/selection.component';
import { DocFormComponentComponent } from './container/component.component';
import { DocFormChecklistComponent } from './container/checklist.component';
import { DocFormLayoutComponent } from './container/layout.component';
import { STATES } from './doc.form.router';
import { DocFormValueComponent } from './container/value.component';
import { DocFormExampleChecklistFormComponent } from './component/checklist.example.form.component';
import { DocFormExampleComponentFormComponent, DocFormExampleComponentFormTestViewAComponent, DocFormExampleComponentFormTestViewBComponent } from './component/component.example.form.component';
import { DocFormExampleComponent } from './component/example.form.component';
import { DocFormTemplateComponent } from './container/template.component';
import { DocFormDirectiveComponent } from './container/directive.component';
import { FormlyMatNativeSelectModule } from '@ngx-formly/material/native-select';
import { DocFormExpressionComponent } from './container/expression.component';
import { DocLayoutComponentsModule } from '../layout/doc.layout.module';
import { DocFormFormComponent } from './container/form.component';

@NgModule({
  imports: [DocSharedModule, FormlyMatNativeSelectModule],
  declarations: [
    //
    DocFormExampleChecklistFormComponent,
    DocFormExampleComponentFormComponent,
    DocFormExampleComponentFormTestViewAComponent,
    DocFormExampleComponentFormTestViewBComponent,
    DocFormExampleComponent
  ],
  exports: [
    //
    DocFormExampleChecklistFormComponent,
    DocFormExampleComponentFormComponent,
    DocFormExampleComponentFormTestViewAComponent,
    DocFormExampleComponentFormTestViewBComponent,
    DocFormExampleComponent
  ]
})
export class DocFormComponentsModule {}

@NgModule({
  imports: [
    DocSharedModule,
    DocLayoutComponentsModule,
    FormlyMatNativeSelectModule,
    DocFormComponentsModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    // container
    DocFormLayoutComponent,
    DocFormHomeComponent,
    DocFormChecklistComponent,
    DocFormValueComponent,
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
