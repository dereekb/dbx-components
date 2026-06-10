# @dereekb/dbx-web/style-demo

Drop-in styling showcase + live CSS-token-override preview harness for dbx-components apps.

Mount `<dbx-style-demo>` on a screen to render dbx UI sections under the host app's _current_ theme, toggle showcase sections on/off, and flip bundles of CSS-token overrides that ripple through every rendered section live via the CSS custom-property cascade. This is the shell entry point: it exposes the playground component, the section registry + providers, the template-toggle providers, and the `DbxStyleDemoStyleLoader*` token-override mechanism, plus a starter set of dbx-web sections.

> The token-override tooling here (loader directive + merge service + debug classes) is **demo/debug-only and disposable** — it is not a dbx-web core runtime primitive and may be removed once the styling migration it supports is complete.

Companion plumbing entries register additional sections under the same shell:

- `@dereekb/dbx-form/style-demo` — `provideDbxFormStyleDemo()`
- `@dereekb/dbx-firebase/style-demo` — `provideDbxFirebaseStyleDemo()`
