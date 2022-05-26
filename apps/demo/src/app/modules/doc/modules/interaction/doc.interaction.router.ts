import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocInteractionHomeComponent } from './container/home.component';
import { DocInteractionLayoutComponent } from './container/layout.component';
import { DocInteractionDialogComponent } from './container/dialog.component';
import { DocInteractionPopoverComponent } from './container/popover.component';
import { DocInteractionPopupComponent } from './container/popup.component';
import { DocInteractionPromptComponent } from './container/prompt.component';
import { DocInteractionFilterComponent } from './container/filter.component';
import { DocInteractionButtonComponent } from './container/button.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/interaction',
  name: 'doc.interaction',
  component: DocInteractionLayoutComponent,
  redirectTo: 'doc.interaction.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.interaction.home',
  component: DocInteractionHomeComponent
};

export const docInteractionButtonState: Ng2StateDeclaration = {
  url: '/button',
  name: 'doc.interaction.button',
  component: DocInteractionButtonComponent
};

export const docInteractionDialogState: Ng2StateDeclaration = {
  url: '/dialog',
  name: 'doc.interaction.dialog',
  component: DocInteractionDialogComponent
};

export const docInteractionFilterState: Ng2StateDeclaration = {
  url: '/filter',
  name: 'doc.interaction.filter',
  component: DocInteractionFilterComponent
};

export const docInteractionPromptState: Ng2StateDeclaration = {
  url: '/prompt',
  name: 'doc.interaction.prompt',
  component: DocInteractionPromptComponent
};

export const docInteractionPopupState: Ng2StateDeclaration = {
  url: '/popup',
  name: 'doc.interaction.popup',
  component: DocInteractionPopupComponent
};

export const docInteractionPopoverState: Ng2StateDeclaration = {
  url: '/popover',
  name: 'doc.interaction.popover',
  component: DocInteractionPopoverComponent
};

export const STATES: Ng2StateDeclaration[] = [layoutState, homeState, docInteractionButtonState, docInteractionDialogState, docInteractionFilterState, docInteractionPromptState, docInteractionPopupState, docInteractionPopoverState];
