// https://dev.to/maciejtrzcinski/100vh-problem-with-ios-safari-3ge9
import { type CssTokenName } from '@dereekb/util';

/**
 * Default CSS custom property name used to store the viewport height value.
 */
export const DEFAULT_VH100_VARIABLE_NAME: CssTokenName = 'vh100';

/**
 * Creates a function that sets a CSS custom property on `document.documentElement` to the current `window.innerHeight` in pixels.
 *
 * This is a workaround for the iOS Safari 100vh bug where `100vh` includes the browser chrome,
 * causing layout overflow. The returned function can be called to refresh the property value.
 *
 * @param cssTokenName - Name of the CSS custom property (without the `--` prefix)
 * @returns A zero-argument function that updates the CSS property to the current inner height
 *
 * @example
 * ```typescript
 * const refresh = refreshVh100Function('vh100');
 * refresh(); // sets --vh100 to e.g. "812px"
 * ```
 */
export function refreshVh100Function(cssTokenName: CssTokenName = DEFAULT_VH100_VARIABLE_NAME) {
  const cssProperty = `--${cssTokenName}`;
  return () => {
    const doc = document.documentElement;
    doc.style.setProperty(cssProperty, `${window.innerHeight}px`);
  };
}

/**
 * Adds window event listeners to populate the css variable `vh100`, or another input variable name, with the current window height.
 *
 * @param cssTokenName - Name of the CSS custom property to update; defaults to `vh100`
 */
export function watchWindowAndUpdateVh100StyleProperty(cssTokenName?: CssTokenName) {
  const refreshPropertyValue = refreshVh100Function(cssTokenName);

  window.addEventListener('resize', refreshPropertyValue);
  window.addEventListener('orientationchange', refreshPropertyValue);
  refreshPropertyValue();
}
