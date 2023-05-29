export const DOC_TEXT_ROUTES = [
  {
    icon: 'text_fields',
    title: 'Text',
    detail: 'text',
    ref: 'doc.text.text'
  },
  {
    icon: 'straighten',
    title: 'Pipes',
    detail: 'pipes',
    ref: 'doc.text.pipes'
  }
];

export const DOC_TEXT_ROOT_ROUTE = {
  icon: 'text_fields',
  title: 'Text',
  detail: 'text',
  ref: 'doc.text',
  children: DOC_TEXT_ROUTES
};
