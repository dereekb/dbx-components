import { type Ng2StateDeclaration } from '@uirouter/angular';
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

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/layout',
  name: 'doc.layout',
  component: DocLayoutLayoutComponent,
  redirectTo: 'doc.layout.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.layout.home',
  component: DocLayoutHomeComponent
};

export const AVATAR_STATE: Ng2StateDeclaration = {
  url: '/avatar',
  name: 'doc.layout.avatar',
  component: DocLayoutAvatarComponent
};

export const DOC_LAYOUT_BAR_STATE: Ng2StateDeclaration = {
  url: '/bar',
  name: 'doc.layout.bar',
  component: DocLayoutBarComponent
};

export const DOC_LAYOUT_CONTENT_STATE: Ng2StateDeclaration = {
  url: '/content',
  name: 'doc.layout.content',
  component: DocLayoutContentComponent
};

export const DOC_LAYOUT_FLEX_STATE: Ng2StateDeclaration = {
  url: '/flex',
  name: 'doc.layout.flex',
  component: DocLayoutFlexComponent
};

export const DOC_LAYOUT_SECTION_STATE: Ng2StateDeclaration = {
  url: '/section',
  name: 'doc.layout.section',
  component: DocLayoutSectionComponent
};

export const DOC_LAYOUT_SECTION_PAGE_STATE: Ng2StateDeclaration = {
  url: '/sectionpage',
  name: 'doc.layout.sectionpage',
  component: DocLayoutSectionPageComponent
};

export const DOC_LAYOUT_SECTION_PAGE_TWO_STATE: Ng2StateDeclaration = {
  url: '/sectionpagetwo',
  name: 'doc.layout.sectionpagetwo',
  component: DocLayoutSectionPageTwoComponent
};

export const DOC_LAYOUT_LIST_STATE: Ng2StateDeclaration = {
  url: '/list',
  name: 'doc.layout.list',
  component: DocLayoutListComponent
};

export const DOC_LAYOUT_TWO_BLOCK_STATE: Ng2StateDeclaration = {
  url: '/block',
  name: 'doc.layout.block',
  component: DocLayoutTwoBlockComponent
};

export const DOC_LAYOUT_TWO_STATE: Ng2StateDeclaration = {
  url: '/two',
  name: 'doc.layout.two',
  component: DocLayoutTwoColumnsComponent
};

export const DOC_LAYOUT_TWO_CHILD_STATE: Ng2StateDeclaration = {
  url: '/child',
  name: 'doc.layout.two.child',
  component: DocLayoutTwoColumnsChildComponent
};

// Sibling child states used by the value-list (hellosubs configuration) example on doc.layout.two.
// Each is a distinct leaf route so exactly one list row is the active route at a time.
export const DOC_LAYOUT_TWO_ITEM_ONE_STATE: Ng2StateDeclaration = {
  url: '/item-one',
  name: 'doc.layout.two.itemOne',
  component: DocLayoutTwoColumnsChildComponent
};

export const DOC_LAYOUT_TWO_ITEM_TWO_STATE: Ng2StateDeclaration = {
  url: '/item-two',
  name: 'doc.layout.two.itemTwo',
  component: DocLayoutTwoColumnsChildComponent
};

export const DOC_LAYOUT_TWO_ITEM_THREE_STATE: Ng2StateDeclaration = {
  url: '/item-three',
  name: 'doc.layout.two.itemThree',
  component: DocLayoutTwoColumnsChildComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  HOME_STATE,
  AVATAR_STATE,
  DOC_LAYOUT_BAR_STATE,
  DOC_LAYOUT_CONTENT_STATE,
  DOC_LAYOUT_FLEX_STATE,
  DOC_LAYOUT_SECTION_STATE,
  DOC_LAYOUT_SECTION_PAGE_STATE,
  DOC_LAYOUT_SECTION_PAGE_TWO_STATE,
  DOC_LAYOUT_LIST_STATE,
  DOC_LAYOUT_TWO_BLOCK_STATE,
  DOC_LAYOUT_TWO_STATE,
  DOC_LAYOUT_TWO_CHILD_STATE,
  DOC_LAYOUT_TWO_ITEM_ONE_STATE,
  DOC_LAYOUT_TWO_ITEM_TWO_STATE,
  DOC_LAYOUT_TWO_ITEM_THREE_STATE
];
