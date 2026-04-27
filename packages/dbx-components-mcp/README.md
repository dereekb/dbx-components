# @dereekb/dbx-components-mcp

MCP server for dbx-components — structured tool access to form fields, Firebase models, server actions, UI components, routes, filters, pipes, and code-scaffolding helpers.

## Tools

Tools are clustered by domain. Each cluster exposes lookup, search, examples, and/or scaffold operations.

Clusters with the `_m` suffix are **model extensions** — tools that walk a downstream app's source tree to verify end-to-end wiring of a specific dbx-components model type.

| Cluster        | Tools                                                                                                                                  |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------|
| form           | `dbx_form_lookup`, `dbx_form_search`, `dbx_form_examples`, `dbx_form_scaffold`                                                         |
| ui             | `dbx_ui_lookup`, `dbx_ui_search`, `dbx_ui_examples`                                                                                    |
| model          | `dbx_model_lookup`, `dbx_model_search`, `dbx_model_decode`, `dbx_model_validate`, `dbx_model_validate_api`, `dbx_model_validate_folder`, `dbx_model_store_scaffold` |
| storagefile_m  | `dbx_storagefile_m_validate_app`, `dbx_storagefile_m_list_app`, `dbx_storagefile_m_validate_folder`                                    |
| notification_m | `dbx_notification_m_validate_app`, `dbx_notification_m_list_app`, `dbx_notification_m_validate_folder`                                 |
| system_m       | `dbx_system_m_validate_folder`                                                                                                         |
| action         | `dbx_action_lookup`, `dbx_action_examples`, `dbx_action_scaffold`                                                                      |
| route          | `dbx_route_tree`, `dbx_route_lookup`, `dbx_route_search`                                                                               |
| filter         | `dbx_filter_lookup`, `dbx_filter_scaffold`                                                                                             |
| pipe           | `dbx_pipe_lookup`                                                                                                                      |
| artifact       | `dbx_artifact_scaffold`, `dbx_artifact_file_convention`                                                                                |

## Resources

URIs are namespaced by domain (`dbx://<domain>/...`). Validators, scaffolders, and route trees don't expose resources because their output depends on caller input rather than a fixed catalog.

| URI                                                  | Description                                            |
|------------------------------------------------------|--------------------------------------------------------|
| `dbx://form/fields`                                  | Form field catalog                                     |
| `dbx://form/fields/{slug}`                           | Single form field entry                                |
| `dbx://form/fields/produces/{produces}`              | Form fields by output primitive                        |
| `dbx://form/fields/tier/{tier}`                      | Form fields by tier                                    |
| `dbx://form/fields/array-output/{arrayOutput}`       | Form fields by array-output flag                       |
| `dbx://model/firebase`                               | Firebase model catalog                                 |
| `dbx://model/firebase/{name}`                        | Single Firebase model                                  |
| `dbx://model/firebase/prefix/{prefix}`               | Firebase model by collection prefix                    |
| `dbx://model/firebase/subcollections/{parent}`       | Subcollection models nested under a parent identity    |
| `dbx://action/entries`                               | Action entries catalog (directives, store, states)     |
| `dbx://action/entries/{slug}`                        | Single action entry                                    |
| `dbx://action/entries/role/{role}`                   | Action entries by role                                 |
| `dbx://ui/components`                                | UI component catalog                                   |
| `dbx://ui/components/{slug}`                         | Single UI entry                                        |
| `dbx://ui/components/category/{category}`            | UI entries by category                                 |
| `dbx://ui/components/kind/{kind}`                    | UI entries by Angular kind                             |
| `dbx://pipe/entries`                                 | Angular pipe catalog                                   |
| `dbx://pipe/entries/{slug}`                          | Single pipe entry                                      |
| `dbx://pipe/entries/category/{category}`             | Pipes by category                                      |
| `dbx://filter/entries`                               | Filter directive / preset catalog                      |
| `dbx://filter/entries/{slug}`                        | Single filter entry                                    |
| `dbx://filter/entries/kind/{kind}`                   | Filter entries by kind (directive, pattern)            |

## Usage

```json
{
  "mcpServers": {
    "dbx-components": {
      "command": "npx",
      "args": ["-y", "@dereekb/dbx-components-mcp"]
    }
  }
}
```

## Generated registry data

The Firebase model registry (`src/registry/firebase-models.generated.ts`) is produced by `scripts/extract-firebase-models.mjs`, which scans `packages/firebase/src/lib/model/**` for `firestoreModelIdentity(...)` calls, converters, interfaces, and enums. Run it via:

```sh
npx nx run dbx-components-mcp:generate-firebase-models
```

The script formats output through Prettier so regenerating produces a byte-equal file when source models haven't changed.
