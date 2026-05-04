# @dereekb/dbx-web/docs

Documentation primitives for dbx-components apps. Provides the `<dbx-docs-ui-example>` component family that wraps a single self-contained UI example with a header, descriptive prose slot, runnable content slot, and optional imports/notes slots.

These components serve a dual purpose:

- **Runtime**: render documentation example pages in a downstream app (e.g. `apps/demo`).
- **MCP catalog source**: the `dbx-components-mcp` UI tools scan example components decorated with `@dbxDocsUiExample` JSDoc tags and use the stable `dbx-docs-ui-example*` selectors as deterministic anchors when extracting body, info, and content into the catalog manifest.

See `@dereekb/dbx-components-mcp` for the matching scanner and tag conventions.
