
export const DOC_FORM_ROUTES = [{
  icon: 'format_list_bulleted',
  title: 'Checklist',
  detail: 'checklist form',
  ref: 'doc.form.checklist'
}, {
  icon: 'code',
  title: 'Component',
  detail: 'component form',
  ref: 'doc.form.component'
}, {
  icon: 'keyboard',
  title: 'Value Fields',
  detail: 'value form fields',
  ref: 'doc.form.value'
}, {
  icon: 'highlight_alt',
  title: 'Selection Fields',
  detail: 'selection form fields',
  ref: 'doc.form.selection'
}, {
  icon: 'article',
  title: 'Text Editor',
  detail: 'text editor',
  ref: 'doc.form.texteditor'
}, {
  icon: 'table_view',
  title: 'Wrappers',
  detail: 'form wrappers',
  ref: 'doc.form.wrapper'
}, {
  icon: 'article',
  title: 'Templates',
  detail: 'form field templates',
  ref: 'doc.form.template'
}];

export const DOC_FORM_ROOT_ROUTE = {
  icon: 'list_alt',
  title: 'Forms',
  detail: 'dbx-form',
  ref: 'doc.form',
  children: DOC_FORM_ROUTES
};
