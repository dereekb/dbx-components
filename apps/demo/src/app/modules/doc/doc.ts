import { DOC_AUTH_ROOT_ROUTE } from './modules/auth/doc.auth';
import { DOC_ACTION_ROOT_ROUTE } from './modules/action/doc.action';
import { DOC_FORM_ROOT_ROUTE } from './modules/form/doc.form';
import { DOC_INTERACTION_ROOT_ROUTE } from './modules/interaction/doc.interaction';
import { DOC_LAYOUT_ROOT_ROUTE } from './modules/layout/doc.layout';
import { DOC_ROUTER_ROOT_ROUTE } from './modules/router/doc.router';
import { DOC_TEXT_ROOT_ROUTE } from './modules/text/doc.text';
import { DOC_EXTENSION_ROOT_ROUTE } from './modules/extension/doc.extension';

export const DOC_HOME_ROUTE = {
  icon: 'home',
  title: 'Docs',
  ref: 'doc.home'
};

export const DOC_ROUTES = [
  //
  DOC_ACTION_ROOT_ROUTE,
  DOC_AUTH_ROOT_ROUTE,
  DOC_INTERACTION_ROOT_ROUTE,
  DOC_FORM_ROOT_ROUTE,
  DOC_LAYOUT_ROOT_ROUTE,
  DOC_ROUTER_ROOT_ROUTE,
  DOC_TEXT_ROOT_ROUTE,
  DOC_EXTENSION_ROOT_ROUTE
];

export const DOC_ROOT_ROUTE = {
  icon: 'sensors',
  title: 'Actions',
  ref: 'doc.action',
  children: DOC_ROUTES
};
