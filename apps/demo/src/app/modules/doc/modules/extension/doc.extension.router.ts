import { type Ng2StateDeclaration } from '@uirouter/angular';
import { DocExtensionLayoutComponent } from './container/layout.component';
import { DocExtensionCalendarComponent } from './container/calendar.component';
import { DocExtensionHomeComponent } from './container/home.component';
import { DocExtensionWidgetComponent } from './container/widget.component';
import { DocExtensionMapboxComponent } from './container/mapbox.component';
import { DocExtensionTableComponent } from './container/table.component';
import { DocExtensionStructureComponent } from './container/structure.component';
import { DocExtensionDownloadComponent } from './container/download.component';
import { DocExtensionStorageFileComponent } from './container/storagefile.component';
import { DocExtensionZipComponent } from './container/zip.component';
import { DocExtensionPdfComponent } from './container/pdf.component';
import { DocExtensionWebFilePreviewComponent } from './container/webfilepreview.component';
import { DocExtensionHelpComponent } from './container/help.component';
import { DocExtensionOidcComponent } from './container/oidc.component';
import { DocExtensionQuizComponent } from './container/quiz.component';

export const LAYOUT_STATE: Ng2StateDeclaration = {
  url: '/extension',
  name: 'doc.extension',
  component: DocExtensionLayoutComponent,
  redirectTo: 'doc.extension.home'
};

export const HOME_STATE: Ng2StateDeclaration = {
  url: '/home',
  name: 'doc.extension.home',
  component: DocExtensionHomeComponent
};

export const DOC_EXTENSION_CALENDAR_STATE: Ng2StateDeclaration = {
  url: '/calendar',
  name: 'doc.extension.calendar',
  component: DocExtensionCalendarComponent
};

export const DOC_EXTENSION_WIDGET_STATE: Ng2StateDeclaration = {
  url: '/widget',
  name: 'doc.extension.widget',
  component: DocExtensionWidgetComponent
};

export const DOC_EXTENSION_MAPBOX_STATE: Ng2StateDeclaration = {
  url: '/mapbox',
  name: 'doc.extension.mapbox',
  component: DocExtensionMapboxComponent
};

export const DOC_EXTENSION_TABLE_STATE: Ng2StateDeclaration = {
  url: '/table',
  name: 'doc.extension.table',
  component: DocExtensionTableComponent
};

export const DOC_EXTENSION_STRUCTURE_STATE: Ng2StateDeclaration = {
  url: '/structure',
  name: 'doc.extension.structure',
  component: DocExtensionStructureComponent
};

export const DOC_EXTENSION_DOWNLOAD_STATE: Ng2StateDeclaration = {
  url: '/download',
  name: 'doc.extension.download',
  component: DocExtensionDownloadComponent
};

export const DOC_EXTENSION_STORAGE_FILE_STATE: Ng2StateDeclaration = {
  url: '/storagefile',
  name: 'doc.extension.storagefile',
  component: DocExtensionStorageFileComponent
};

export const DOC_EXTENSION_ZIP_STATE: Ng2StateDeclaration = {
  url: '/zip',
  name: 'doc.extension.zip',
  component: DocExtensionZipComponent
};

export const DOC_EXTENSION_PDF_STATE: Ng2StateDeclaration = {
  url: '/pdf',
  name: 'doc.extension.pdf',
  component: DocExtensionPdfComponent
};

export const DOC_EXTENSION_WEB_FILE_PREVIEW_STATE: Ng2StateDeclaration = {
  url: '/webfilepreview',
  name: 'doc.extension.webfilepreview',
  component: DocExtensionWebFilePreviewComponent
};

export const DOC_EXTENSION_HELP_STATE: Ng2StateDeclaration = {
  url: '/help',
  name: 'doc.extension.help',
  component: DocExtensionHelpComponent
};

export const DOC_EXTENSION_OIDC_STATE: Ng2StateDeclaration = {
  url: '/oidc',
  name: 'doc.extension.oidc',
  component: DocExtensionOidcComponent
};

export const DOC_EXTENSION_QUIZ_STATE: Ng2StateDeclaration = {
  url: '/quiz',
  name: 'doc.extension.quiz',
  component: DocExtensionQuizComponent
};

export const STATES: Ng2StateDeclaration[] = [
  //
  LAYOUT_STATE,
  HOME_STATE,
  DOC_EXTENSION_CALENDAR_STATE,
  DOC_EXTENSION_WIDGET_STATE,
  DOC_EXTENSION_MAPBOX_STATE,
  DOC_EXTENSION_TABLE_STATE,
  DOC_EXTENSION_STRUCTURE_STATE,
  DOC_EXTENSION_DOWNLOAD_STATE,
  DOC_EXTENSION_STORAGE_FILE_STATE,
  DOC_EXTENSION_ZIP_STATE,
  DOC_EXTENSION_PDF_STATE,
  DOC_EXTENSION_WEB_FILE_PREVIEW_STATE,
  DOC_EXTENSION_HELP_STATE,
  DOC_EXTENSION_OIDC_STATE,
  DOC_EXTENSION_QUIZ_STATE
];
