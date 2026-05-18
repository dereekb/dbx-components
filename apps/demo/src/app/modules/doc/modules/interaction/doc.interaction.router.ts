import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocInteractionHomeComponent } from './container/home.component';
import { DocInteractionLayoutComponent } from './container/layout.component';
import { DocInteractionDetachComponent } from './container/detach.component';
import { DocInteractionDialogComponent } from './container/dialog.component';
import { DocInteractionPopoverComponent } from './container/popover.component';
import { DocInteractionPopupComponent } from './container/popup.component';
import { DocInteractionPromptComponent } from './container/prompt.component';
import { DocInteractionFilterComponent } from './container/filter.component';
import { DocInteractionButtonComponent } from './container/button.component';
import { DocInteractionErrorComponent } from './container/error.component';
import { DocInteractionLoadingComponent } from './container/loading.component';
import { DocInteractionIframeComponent } from './container/iframe.component';
import { DocInteractionUploadComponent } from './container/upload.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/interaction',
  name: 'doc.interaction',
  component: DocInteractionLayoutComponent,
  redirectTo: 'doc.interaction.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.interaction.home',
  component: DocInteractionHomeComponent
};

export const DOC_INTERACTION_DETACH_STATE: Ng2StateDeclaration = {
  url: '/detach',
  name: 'doc.interaction.detach',
  component: DocInteractionDetachComponent
};

export const DOC_INTERACTION_BUTTON_STATE: Ng2StateDeclaration = {
  url: '/button',
  name: 'doc.interaction.button',
  component: DocInteractionButtonComponent
};

export const DOC_INTERACTION_ERROR_STATE: Ng2StateDeclaration = {
  url: '/error',
  name: 'doc.interaction.error',
  component: DocInteractionErrorComponent
};

export const DOC_INTERACTION_LOADING_STATE: Ng2StateDeclaration = {
  url: '/loading',
  name: 'doc.interaction.loading',
  component: DocInteractionLoadingComponent
};

export const DOC_INTERACTION_DIALOG_STATE: Ng2StateDeclaration = {
  url: '/dialog',
  name: 'doc.interaction.dialog',
  component: DocInteractionDialogComponent
};

export const DOC_INTERACTION_IFRAME_STATE: Ng2StateDeclaration = {
  url: '/iframe',
  name: 'doc.interaction.iframe',
  component: DocInteractionIframeComponent
};

export const DOC_INTERACTION_FILTER_STATE: Ng2StateDeclaration = {
  url: '/filter',
  name: 'doc.interaction.filter',
  component: DocInteractionFilterComponent
};

export const DOC_INTERACTION_PROMPT_STATE: Ng2StateDeclaration = {
  url: '/prompt',
  name: 'doc.interaction.prompt',
  component: DocInteractionPromptComponent
};

export const DOC_INTERACTION_POPUP_STATE: Ng2StateDeclaration = {
  url: '/popup',
  name: 'doc.interaction.popup',
  component: DocInteractionPopupComponent
};

export const DOC_INTERACTION_POPOVER_STATE: Ng2StateDeclaration = {
  url: '/popover',
  name: 'doc.interaction.popover',
  component: DocInteractionPopoverComponent
};

export const DOC_INTERACTION_UPLOAD_STATE: Ng2StateDeclaration = {
  url: '/upload',
  name: 'doc.interaction.upload',
  component: DocInteractionUploadComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  HOME_STATE,
  DOC_INTERACTION_DETACH_STATE,
  DOC_INTERACTION_BUTTON_STATE,
  DOC_INTERACTION_ERROR_STATE,
  DOC_INTERACTION_LOADING_STATE,
  DOC_INTERACTION_DIALOG_STATE,
  DOC_INTERACTION_FILTER_STATE,
  DOC_INTERACTION_PROMPT_STATE,
  DOC_INTERACTION_POPUP_STATE,
  DOC_INTERACTION_POPOVER_STATE,
  DOC_INTERACTION_IFRAME_STATE,
  DOC_INTERACTION_UPLOAD_STATE
];
