import { Ng2StateDeclaration } from '@uirouter/angular';
import { DocLayoutBarComponent } from './container/bar.component';
import { DocLayoutTwoBlockComponent } from './container/block.component';
import { DocLayoutContentComponent } from './container/content.component';
import { DocLayoutFlexComponent } from './container/flex.component';
import { DocLayoutHomeComponent } from './container/home.component';
import { DocLayoutLayoutComponent } from './container/layout.component';
import { DocLayoutListComponent } from './container/list.component';
import { DocLayoutSectionComponent } from './container/section.component';
import { DocLayoutSectionPageComponent } from './container/section.page.component';
import { DocLayoutSectionPageTwoComponent } from './container/section.page.two.component';
import { DocLayoutTwoColumnsChildComponent } from './container/two.child.component';
import { DocLayoutTwoColumnsComponent } from './container/two.component';
import { DocLayoutAvatarComponent } from './container/avatar.component';

export const layoutState: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout',
  component: DocLayoutLayoutComponent,
  redirectTo: 'doc.layout.home'
};

export const homeState: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.layout.home',
  component: DocLayoutHomeComponent
};

export const avatarState: Ng2StateDeclaration = {
  url: '/avatar',
  name: 'doc.layout.avatar',
  component: DocLayoutAvatarComponent
};

export const docLayoutBarState: Ng2StateDeclaration = {
  url: '/bar',
  name: 'doc.layout.bar',
  component: DocLayoutBarComponent
};

export const docLayoutContentState: Ng2StateDeclaration = {
  url: '/content',
  name: 'doc.layout.content',
  component: DocLayoutContentComponent
};

export const docLayoutFlexState: Ng2StateDeclaration = {
  url: '/flex',
  name: 'doc.layout.flex',
  component: DocLayoutFlexComponent
};

export const docLayoutSectionState: Ng2StateDeclaration = {
  url: '/section',
  name: 'doc.layout.section',
  component: DocLayoutSectionComponent
};

export const docLayoutSectionPageState: Ng2StateDeclaration = {
  url: '/sectionpage',
  name: 'doc.layout.sectionpage',
  component: DocLayoutSectionPageComponent
};

export const docLayoutSectionPageTwoState: Ng2StateDeclaration = {
  url: '/sectionpagetwo',
  name: 'doc.layout.sectionpagetwo',
  component: DocLayoutSectionPageTwoComponent
};

export const docLayoutListState: Ng2StateDeclaration = {
  url: '/list',
  name: 'doc.layout.list',
  component: DocLayoutListComponent
};

export const docLayoutTwoBlockState: Ng2StateDeclaration = {
  url: '/block',
  name: 'doc.layout.block',
  component: DocLayoutTwoBlockComponent
};

export const docLayoutTwoState: Ng2StateDeclaration = {
  url: '/two',
  name: 'doc.layout.two',
  component: DocLayoutTwoColumnsComponent
};

export const docLayoutTwoChildState: Ng2StateDeclaration = {
  url: '/child',
  name: 'doc.layout.two.child',
  component: DocLayoutTwoColumnsChildComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  layoutState,
  homeState,
  avatarState,
  docLayoutBarState,
  docLayoutContentState,
  docLayoutFlexState,
  docLayoutSectionState,
  docLayoutSectionPageState,
  docLayoutSectionPageTwoState,
  docLayoutListState,
  docLayoutTwoBlockState,
  docLayoutTwoState,
  docLayoutTwoChildState
];
