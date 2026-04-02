/**
 * Display modes for the sidenav based on screen width.
 *
 * - `NONE` - Sidenav is hidden.
 * - `MOBILE` - Sidenav is an overlay drawer, closed by default.
 * - `ICON` - Sidenav is a persistent narrow rail showing icons only.
 * - `FULL` - Sidenav is a persistent full-width panel.
 */
export enum SideNavDisplayMode {
  NONE = 'none',
  MOBILE = 'mobile',
  ICON = 'icon',
  FULL = 'full'
}

/**
 * String union type matching the {@link SideNavDisplayMode} enum values.
 *
 * Useful for template bindings where string literals are passed directly.
 */
export type SideNavDisplayModeString = `${SideNavDisplayMode}`;

/**
 * Position of the sidenav drawer.
 *
 * - `start` - Left side (default, LTR).
 * - `end` - Right side (LTR).
 */
export type DbxSidenavPosition = 'start' | 'end';
