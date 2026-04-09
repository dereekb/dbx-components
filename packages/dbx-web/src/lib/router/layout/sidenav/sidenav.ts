import { type Maybe } from '@dereekb/util';

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
 * Ordered list of {@link SideNavDisplayMode} values from lowest to highest.
 *
 * Used by {@link resolveSideNavDisplayMode} for rounding down to an allowed mode.
 */
export const SIDE_NAV_DISPLAY_MODE_ORDER: readonly SideNavDisplayMode[] = [SideNavDisplayMode.NONE, SideNavDisplayMode.MOBILE, SideNavDisplayMode.ICON, SideNavDisplayMode.FULL];

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

/**
 * Resolves a {@link SideNavDisplayMode} against a set of allowed modes.
 *
 * If the requested mode is allowed, it is returned as-is. Otherwise, the nearest
 * allowed mode that is lower in the {@link SIDE_NAV_DISPLAY_MODE_ORDER} hierarchy is returned.
 * Falls back to the lowest allowed mode if no lower mode is available, or {@link SideNavDisplayMode.NONE}
 * if the allowed set is empty or undefined.
 *
 * @example
 * ```ts
 * // ICON not allowed, rounds down to MOBILE
 * resolveSideNavDisplayMode(SideNavDisplayMode.ICON, new Set([SideNavDisplayMode.MOBILE, SideNavDisplayMode.FULL]));
 * // => SideNavDisplayMode.MOBILE
 * ```
 *
 * @param mode - The requested display mode to resolve.
 * @param allowedModes - Set of modes that are permitted; if null/undefined, all modes are allowed.
 * @returns The resolved display mode, falling back to the nearest lower allowed mode or NONE.
 */
export function resolveSideNavDisplayMode(mode: SideNavDisplayMode, allowedModes: Maybe<Set<SideNavDisplayMode>>): SideNavDisplayMode {
  let result: SideNavDisplayMode;

  if (!allowedModes || allowedModes.has(mode)) {
    result = mode;
  } else {
    const modeIndex = SIDE_NAV_DISPLAY_MODE_ORDER.indexOf(mode);
    let resolved: Maybe<SideNavDisplayMode>;

    // search downward for the nearest allowed mode
    for (let i = modeIndex - 1; i >= 0; i--) {
      if (allowedModes.has(SIDE_NAV_DISPLAY_MODE_ORDER[i])) {
        resolved = SIDE_NAV_DISPLAY_MODE_ORDER[i];
        break;
      }
    }

    // fallback to the lowest allowed mode if no lower mode was found
    if (resolved == null) {
      for (const m of SIDE_NAV_DISPLAY_MODE_ORDER) {
        if (allowedModes.has(m)) {
          resolved = m;
          break;
        }
      }
    }

    result = resolved ?? SideNavDisplayMode.NONE;
  }

  return result;
}
