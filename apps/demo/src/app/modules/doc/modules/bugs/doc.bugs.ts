export const DOC_BUGS_ROUTES = [
  {
    icon: 'list_alt',
    title: 'Forms',
    detail: 'form bug tests',
    ref: 'doc.bugs.forms'
  },
  {
    icon: 'event',
    title: 'Calendar',
    detail: 'calendar selection store filter + minMaxDateRange bug',
    ref: 'doc.bugs.calendar'
  }
];

export const DOC_BUGS_ROOT_ROUTE = {
  icon: 'bug_report',
  title: 'Bug Tests',
  detail: 'bug reproductions',
  ref: 'doc.bugs',
  children: DOC_BUGS_ROUTES
};
