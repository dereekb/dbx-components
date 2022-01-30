// https://dev.to/maciejtrzcinski/100vh-problem-with-ios-safari-3ge9

export const DEFAULT_VH100_VARIABLE_NAME = 'vh100';

export function refreshVh100Function(cssVariableName = DEFAULT_VH100_VARIABLE_NAME) {
  const cssProperty = `--${cssVariableName}`;
  return () => {
    const doc = document.documentElement;
    doc.style.setProperty(cssProperty, `${window.innerHeight}px`);
  }
};

/**
 * Adds window event listeners to populate the css variable `vh100`, or another input variable name, with the current window height.
 */
export function watchWindowAndUpdateVh100StyleProperty(cssVariableName?: string) {
  const refreshPropertyValue = refreshVh100Function(cssVariableName);

  window.addEventListener('resize', refreshPropertyValue);
  window.addEventListener('orientationchange', refreshPropertyValue);
  refreshPropertyValue();
  
}
