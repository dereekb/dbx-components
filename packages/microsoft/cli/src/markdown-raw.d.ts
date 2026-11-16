/**
 * Types the `?raw` markdown imports that embed the package's shipped refs (`packages/microsoft/refs/`) in the bundle.
 * esbuild loads them as text through the `.md` loader in project.json; Vitest loads `?raw` natively.
 */
declare module '*.md?raw' {
  const CONTENT: string;
  export default CONTENT;
}
