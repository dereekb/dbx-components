import { type DbxThemeColor } from '../style/style';

/**
 * Named theme color used by the {@link DbxPagebarComponent} family of components,
 * which apply a `dbx-bar-{color}` CSS class. Unlike {@link DbxBarDirective} (which
 * accepts the wider `DbxColorInput` union), these components only support
 * named-color strings.
 */
export type DbxBarColor = DbxThemeColor;
