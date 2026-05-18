import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocFormHomeComponent } from './container/home.component';
import { DocFormLayoutComponent } from './container/layout.component';
import { DocFormValueComponent } from './container/value.component';
import { DocFormWrapperComponent } from './container/wrapper.component';
import { DocFormTextEditorComponent } from './container/texteditor.component';
import { DocFormSelectionComponent } from './container/selection.component';
import { DocFormComponentComponent } from './container/component.component';
import { DocFormChecklistComponent } from './container/checklist.component';
import { DocFormTemplateComponent } from './container/template.component';
import { DocFormDirectiveComponent } from './container/directive.component';
import { DocFormExpressionComponent } from './container/expression.component';
import { DocFormFormComponent } from './container/form.component';
import { DocFormDateValueComponent } from './container/value.date.component';
import { DocFormArrayComponent } from './container/array.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.form',
  component: DocFormLayoutComponent,
  redirectTo: 'doc.form.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.form.home',
  component: DocFormHomeComponent
};

export const DOC_FORM_VALUE_STATE: Ng2StateDeclaration = {
  url: '/value',
  name: 'doc.form.value',
  component: DocFormValueComponent
};

export const DOC_FORM_DATE_VALUE_STATE: Ng2StateDeclaration = {
  url: '/date',
  name: 'doc.form.date',
  component: DocFormDateValueComponent
};

export const DOC_FORM_CHECKLIST_STATE: Ng2StateDeclaration = {
  url: '/checklist',
  name: 'doc.form.checklist',
  component: DocFormChecklistComponent
};

export const DOC_FORM_COMPONENT_STATE: Ng2StateDeclaration = {
  url: '/component',
  name: 'doc.form.component',
  component: DocFormComponentComponent
};

export const DOC_FORM_EXPRESSION_STATE: Ng2StateDeclaration = {
  url: '/expression',
  name: 'doc.form.expression',
  component: DocFormExpressionComponent
};

export const DOC_FORM_SELECTION_STATE: Ng2StateDeclaration = {
  url: '/selection',
  name: 'doc.form.selection',
  component: DocFormSelectionComponent
};

export const DOC_FORM_TEXT_EDITOR_STATE: Ng2StateDeclaration = {
  url: '/texteditor',
  name: 'doc.form.texteditor',
  component: DocFormTextEditorComponent
};

export const DOC_FORM_WRAPPER_STATE: Ng2StateDeclaration = {
  url: '/wrapper',
  name: 'doc.form.wrapper',
  component: DocFormWrapperComponent
};

export const DOC_FORM_DIRECTIVE_STATE: Ng2StateDeclaration = {
  url: '/directive',
  name: 'doc.form.directive',
  component: DocFormDirectiveComponent
};

export const DOC_FORM_TEMPLATE_STATE: Ng2StateDeclaration = {
  url: '/template',
  name: 'doc.form.template',
  component: DocFormTemplateComponent
};

export const DOC_FORM_ARRAY_STATE: Ng2StateDeclaration = {
  url: '/array',
  name: 'doc.form.array',
  component: DocFormArrayComponent
};

export const DOC_FORM_FORM_STATE: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.form.form',
  component: DocFormFormComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  HOME_STATE,
  DOC_FORM_VALUE_STATE,
  DOC_FORM_DATE_VALUE_STATE,
  DOC_FORM_CHECKLIST_STATE,
  DOC_FORM_COMPONENT_STATE,
  DOC_FORM_EXPRESSION_STATE,
  DOC_FORM_SELECTION_STATE,
  DOC_FORM_TEXT_EDITOR_STATE,
  DOC_FORM_ARRAY_STATE,
  DOC_FORM_WRAPPER_STATE,
  DOC_FORM_DIRECTIVE_STATE,
  DOC_FORM_TEMPLATE_STATE,
  DOC_FORM_FORM_STATE
];
