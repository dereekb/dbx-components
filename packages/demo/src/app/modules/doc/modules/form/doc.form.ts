
export const DOC_FORM_ROUTES = [{
  icon: 'check_box',
  title: 'Boolean',
  detail: 'boolean forms',
  ref: 'doc.form.boolean'
}, {
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
  icon: 'event',
  title: 'Date',
  detail: 'date forms',
  ref: 'doc.form.date'
}, {
  icon: 'keyboard',
  title: 'Generic',
  detail: 'gerneric forms',
  ref: 'doc.form.generic'
}, {
  icon: 'phone',
  title: 'Phone Number',
  detail: 'phone number forms',
  ref: 'doc.form.phone'
}, {
  icon: 'edit',
  title: 'Text',
  detail: 'text forms',
  ref: 'doc.form.text'
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
}];

export const DOC_FORM_ROOT_ROUTE = {
  icon: 'list_alt',
  title: 'Forms',
  ref: 'doc.form',
  children: DOC_FORM_ROUTES
};
