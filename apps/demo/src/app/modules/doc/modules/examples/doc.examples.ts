export interface DocExamplesRoute {
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
  readonly ref: string;
}

export const DOC_EXAMPLES_ROUTES: DocExamplesRoute[] = [
  {
    icon: 'list',
    title: 'List',
    detail: 'list workflow examples',
    ref: 'doc.examples.list'
  },
  {
    icon: 'credit_card',
    title: 'Card',
    detail: 'card layout examples',
    ref: 'doc.examples.card'
  },
  {
    icon: 'bolt',
    title: 'Action',
    detail: 'action pattern examples',
    ref: 'doc.examples.action'
  },
  {
    icon: 'dashboard',
    title: 'Layout',
    detail: 'page-level layout examples',
    ref: 'doc.examples.layout'
  }
];

export const DOC_EXAMPLES_ROOT_ROUTE = {
  icon: 'auto_awesome',
  title: 'Examples',
  detail: 'reusable UI workflow examples',
  ref: 'doc.examples',
  children: DOC_EXAMPLES_ROUTES
};
