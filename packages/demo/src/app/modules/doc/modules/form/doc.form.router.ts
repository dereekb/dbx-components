import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocFormHomeComponent } from './container/home.component';
import { DocFormLayoutComponent } from './container/layout.component';
import { DocFormBooleanComponent } from './container/boolean.component';
import { DocFormWrapperComponent } from './container/wrapper.component';
import { DocFormTextEditorComponent } from './container/texteditor.component';
import { DocFormTextComponent } from './container/text.component';
import { DocFormPhoneComponent } from './container/phone.component';
import { DocFormGenericComponent } from './container/generic.component';
import { DocFormComponentComponent } from './container/component.component';
import { DocFormChecklistComponent } from './container/checklist.component';
import { DocFormDateComponent } from './container/date.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/form',
  name: 'doc.form',
  component: DocFormLayoutComponent,
  redirectTo: 'doc.form.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.form.home',
  component: DocFormHomeComponent,
};

export const docFormBooleanState: Ng2StateDeclaration = {
  url: '/boolean',
  name: 'doc.form.boolean',
  component: DocFormBooleanComponent
};

export const docFormChecklistState: Ng2StateDeclaration = {
  url: '/checklist',
  name: 'doc.form.checklist',
  component: DocFormChecklistComponent,
};

export const docFormComponentState: Ng2StateDeclaration = {
  url: '/component',
  name: 'doc.form.component',
  component: DocFormComponentComponent,
};

export const docFormDateState: Ng2StateDeclaration = {
  url: '/date',
  name: 'doc.form.date',
  component: DocFormDateComponent,
};

export const docFormGenericState: Ng2StateDeclaration = {
  url: '/generic',
  name: 'doc.form.generic',
  component: DocFormGenericComponent,
};

export const docFormPhoneState: Ng2StateDeclaration = {
  url: '/phone',
  name: 'doc.form.phone',
  component: DocFormPhoneComponent,
};

export const docFormTextState: Ng2StateDeclaration = {
  url: '/text',
  name: 'doc.form.text',
  component: DocFormTextComponent,
};

export const docFormTextEditorState: Ng2StateDeclaration = {
  url: '/texteditor',
  name: 'doc.form.texteditor',
  component: DocFormTextEditorComponent,
};

export const docFormWrapperState: Ng2StateDeclaration = {
  url: '/wrapper',
  name: 'doc.form.wrapper',
  component: DocFormWrapperComponent,
};

export const STATES: Ng2StateDeclaration[] = [
  layoutState,
  homeState,
  docFormBooleanState,
  docFormChecklistState,
  docFormComponentState,
  docFormDateState,
  docFormGenericState,
  docFormPhoneState,
  docFormTextState,
  docFormTextEditorState,
  docFormWrapperState
];
