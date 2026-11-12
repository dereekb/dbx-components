---
name: package-refs
description: "How a package ships its own agent docs (dbx-claude refs) inside its npm package, so the doc an agent reads matches the installed version. Covers the layout (`refs/<name>/REF.md` plus flat `references/<doc>.md` sub-docs), the `package.json` `dbxClaude.refs` declaration (only `name` + `triggers`; packages can only suggest), the rollup asset line, embedding the same files in a CLI bundle with `?raw` imports and an esbuild `.md` text loader, the shared `<cli> docs [topic]` command (`createPackageRefsDocsCommand`), the `validatePackageRefs` spec, how dbx-claude discovers and resolves package refs (`references.packages`, precedence, ids, shadowing), and moving a bundled dbx-claude ref into its package. Ships with `@dereekb/dbx-cli`."
---

# Package-shipped refs

A package can ship its own agent docs ("refs") inside its npm package. dbx-claude reads them from the
project's installed dependencies, so the doc an agent reads always matches the installed version. A
package with a CLI also embeds the same files in its bundle and prints them with `<cli> docs`.

This is for authors of `@dereekb/*` packages, and of any package a dbx-claude project consumes. The
first adopters are `@dereekb/microsoft` (`msgraph-cli`) and `@dereekb/dbx-cli` (this doc).

There is exactly one copy of each doc: the files under `refs/`. The published package, the CLI bundle
and dbx-claude all read them. Never hand-maintain a second copy.

## Layout

```
packages/<pkg>/
  package.json              # "dbxClaude": { "refs": [ ... ] }
  rollup.config.cjs         # copies refs/ into the published package
  refs/
    <name>/
      REF.md                # frontmatter: name (= <name>), description
      references/           # optional
        <doc>.md            # sub-doc; key = file name without .md; flat, no subfolders
```

- Published as `node_modules/<pkg>/refs/<name>/REF.md` (plus `references/`).
- `<name>` and `<doc>` match `^[a-z0-9][a-z0-9-]*$`.
- REF.md frontmatter is `name` + `description`, like a bundled dbx-claude ref. The `description` is what
  an agent sees before it fetches the doc, so name the commands, options and error codes it covers.
- REF.md lists every sub-doc key (the hub convention). Only `.md` files ship.
- Cross-link other refs by name (`dbx-claude-ref { ref: 'cli-handoff' }`), never by path or id.

## Declaration: `package.json` → `dbxClaude.refs`

```json
"dbxClaude": {
  "refs": [
    {
      "name": "msgraph-cli",
      "triggers": [
        { "words": ["msgraph-cli", "Microsoft Graph"] },
        { "pathContains": ["/microsoft/cli/"], "capabilities": ["dbx-components"], "every": 8 }
      ]
    }
  ]
}
```

- **Allowed keys:** `name` (required) and `triggers` (optional). A trigger is the same object as a
  dbx-claude marker `references.project[].triggers` entry: `words`, `fuzzyWords`, `pathContains`,
  `suffixes`, `toolNames`, `capabilities`, `every`, … Keys in one trigger are ANDed; triggers are ORed.
- **Rejected keys:** `id`, `path`, `source`, `delivery`, `tone`, `reReadOnRefire`, `maxFires`,
  `maxDenies`. A package can only *suggest*: dbx-claude always delivers a package ref as a read hint,
  and coerces a per-trigger `tone` / `delivery` to `hint` / `read`. A consuming project that wants
  more escalates through its own `hints.refs.<name>` override.
- Pick trigger words an agent would only say about this package. Bare generic words (`REF.md`,
  `Graph`, `docs`) fire in every session.
- The key rides into `dist` untouched: the build copies the source `package.json` keys.

## Build wiring

Add one entry to the package's root `rollup.config.cjs` `assets`:

```js
{ glob: '**/*.md', input: 'packages/<pkg>/refs', output: 'refs' }
```

Nx moves a glob's literal prefix into `input`, so `{ glob: 'packages/<pkg>/refs/**', input: '.', output: '.' }`
would drop the `refs/` folder name. Use the form above. Nothing else is needed: there is no `files`
whitelist.

## Embedding in a CLI bundle

A package CLI embeds the same files, so a single-file CLI download carries its docs too.

1. Import every file with `?raw` in one module, e.g. `src/lib/docs/<cli>.docs.ts`:

   ```ts
   import { type EmbeddedPackageRefs } from '@dereekb/dbx-cli';
   import msgraphCliRef from '../../../../refs/msgraph-cli/REF.md?raw';

   export const MSGRAPH_CLI_PACKAGE_REFS: EmbeddedPackageRefs = {
     packageName: '@dereekb/microsoft',
     refs: [{ name: 'msgraph-cli', content: msgraphCliRef /* , docs: { mail: mailDoc } */ }]
   };
   ```

2. Tell esbuild to load `.md` as text. In the CLI's `build-base` target (`@nx/esbuild:esbuild`), set
   `options.esbuildOptions.loader` to `{ ".md": "text" }`. esbuild strips `?raw` and inlines the text.
3. Type the import. Add `src/markdown-raw.d.ts`:

   ```ts
   declare module '*.md?raw' {
     const content: string;
     export default content;
   }
   ```

   Specs already get `*?raw` from `vite/client`, and Vitest loads `?raw` natively.
4. Register the shared command with the CLI's *config* commands (no auth, no output filtering):

   ```ts
   const configCommands = [AUTH_COMMAND, CONFIG_COMMAND, outputCommand, createPackageRefsDocsCommand({ cliName: MSGRAPH_CLI_NAME, refs: MSGRAPH_CLI_PACKAGE_REFS })];
   ```

`<cli> docs` prints a markdown index; `<cli> docs <ref>` prints REF.md verbatim (frontmatter
included, byte-identical to what dbx-claude serves); `<cli> docs <ref>/<doc>` prints a sub-doc, and a
bare `<doc>` works when exactly one ref has it. `--json` wraps either in the `{ ok, data }` envelope.
Errors: `DOCS_TOPIC_NOT_FOUND` (unknown topic) and `DOCS_TOPIC_AMBIGUOUS` (a bare doc two refs share);
both list the topics in `suggestion`.

Nx's `^production` input already invalidates the CLI bundle and its tests when a REF.md changes, so
the embedded copy cannot go stale.

## Validate it in a spec

`validatePackageRefs` checks the declaration, that each REF.md exists with a matching frontmatter
`name` and a `description`, that every `refs/` folder is declared and every sub-doc is flat and listed
in REF.md, that the rollup asset entry is present, and (given `embedded`) that the CLI embeds exactly
the files on disk.

```ts
import { validatePackageRefs } from '@dereekb/dbx-cli';
import { resolve } from 'node:path';
import { MSGRAPH_CLI_PACKAGE_REFS } from './msgraph.docs';

describe('msgraph-cli package refs', () => {
  it('should ship and embed every declared ref', () => {
    expect(validatePackageRefs({ packageRoot: resolve(import.meta.dirname, '../../../../..'), embedded: MSGRAPH_CLI_PACKAGE_REFS })).toEqual([]);
  });
});
```

A package without a CLI drops `embedded`. Trigger contents are not checked here; dbx-claude's doctor
owns the trigger schema.

## How dbx-claude finds them

- **Discovery.** dbx-claude reads the direct `dependencies`, `devDependencies` and
  `optionalDependencies` of the project's nearest `package.json`, resolves each through
  `node_modules` (Node's walk-up lookup), and reads its `dbxClaude.refs`. Content is read live from
  the installed package and never deployed.
- **Trust.** Only `@dereekb/*` packages are read by default: a dependency's refs are text an agent
  acts on. Other scopes opt in through the marker's `references.packages.allow`.
- **Workspace sources.** A repo that authors packages lists their folders in
  `references.packages.workspace` (dbx-components: `["packages/*"]`); a workspace source wins over
  `node_modules`.
- **Precedence by name.** A project's declared ref (or `.cloud` skill) beats a package ref, which
  beats a bundled dbx-claude ref. Two packages declaring one name: the first package name wins and
  the doctor warns.
- **Ids.** Package refs are fetched by name (`dbx-claude-ref { ref: 'msgraph-cli' }`). A package ref
  that shadows a bundled ref also answers that bundled id, and the bundled ref's triggers are dropped
  in that project.
- **Config.** `references.packages` takes `enabled`, `allow`, `exclude` and `workspace`; see the
  `dbx-claude-config` ref (id 17). `dbx-claude doctor` lists the discovered refs as `name ← pkg@version`.

## Moving a bundled dbx-claude ref into its package

1. Copy `capability/hint/refs/<name>/REF.md` (and `references/`) to `packages/<pkg>/refs/<name>/`,
   correct it against the code, and keep the same name so the bundled id keeps answering.
2. Port its `config.ts` triggers into the `dbxClaude.refs` entry (drop `delivery` / `tone`).
3. Wire the rollup line, the CLI embedding and the spec as above.
4. In dbx-claude, replace the bundled REF.md with a short pointer and keep its id slot and triggers
   (bundled ids must stay contiguous). The pointer only shows in projects whose installed package
   predates the shipped ref, so it tells them to upgrade.

## Checklist

- [ ] `refs/<name>/REF.md` with frontmatter `name` + `description`; sub-docs flat under `references/` and listed in REF.md
- [ ] `package.json` `dbxClaude.refs` entry: `name` + specific `triggers`, nothing else
- [ ] `rollup.config.cjs` asset `{ glob: '**/*.md', input: 'packages/<pkg>/refs', output: 'refs' }`
- [ ] CLI only: `?raw` imports, esbuild `.md` text loader, `markdown-raw.d.ts`, `createPackageRefsDocsCommand` in the config commands
- [ ] A spec asserting `validatePackageRefs(...)` returns `[]`
- [ ] After a build: `dist/packages/<pkg>/refs/<name>/REF.md` exists and `<cli> docs` lists it
