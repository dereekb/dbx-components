import { Ng2StateDeclaration } from '@uirouter/angular';
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

export const layoutState: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.form',
  component: DocFormLayoutComponent,
  redirectTo: 'doc.form.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.form.home',
  component: DocFormHomeComponent
};

export const docFormValueState: Ng2StateDeclaration = {
  url: '/value',
  name: 'doc.form.value',
  component: DocFormValueComponent
};

export const docFormChecklistState: Ng2StateDeclaration = {
  url: '/checklist',
  name: 'doc.form.checklist',
  component: DocFormChecklistComponent
};

export const docFormComponentState: Ng2StateDeclaration = {
  url: '/component',
  name: 'doc.form.component',
  component: DocFormComponentComponent
};

export const docFormExpressionState: Ng2StateDeclaration = {
  url: '/expression',
  name: 'doc.form.expression',
  component: DocFormExpressionComponent
};

export const docFormSelectionState: Ng2StateDeclaration = {
  url: '/selection',
  name: 'doc.form.selection',
  component: DocFormSelectionComponent
};

export const docFormTextEditorState: Ng2StateDeclaration = {
  url: '/texteditor',
  name: 'doc.form.texteditor',
  component: DocFormTextEditorComponent
};

export const docFormWrapperState: Ng2StateDeclaration = {
  url: '/wrapper',
  name: 'doc.form.wrapper',
  component: DocFormWrapperComponent
};

export const docFormDirectiveState: Ng2StateDeclaration = {
  url: '/directive',
  name: 'doc.form.directive',
  component: DocFormDirectiveComponent
};

export const docFormTemplateState: Ng2StateDeclaration = {
  url: '/template',
  name: 'doc.form.template',
  component: DocFormTemplateComponent
};

export const docFormFormState: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.form.form',
  component: DocFormFormComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  layoutState,
  homeState,
  docFormValueState,
  docFormChecklistState,
  docFormComponentState,
  docFormExpressionState,
  docFormSelectionState,
  docFormTextEditorState,
  docFormWrapperState,
  docFormDirectiveState,
  docFormTemplateState,
  docFormFormState
];
