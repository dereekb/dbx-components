# @dereekb/dbx-components-mcp

MCP server for dbx-components — structured tool access to forge fields, Firebase models, server actions, UI components, routes, filters, pipes, and code-scaffolding helpers.

## Tools

Tools are clustered by domain. Each cluster exposes lookup, search, examples, and/or scaffold operations.

| Cluster      | Tools                                                                                                                                  |
|--------------|----------------------------------------------------------------------------------------------------------------------------------------|
| form         | `dbx_form_lookup`, `dbx_form_search`, `dbx_form_examples`, `dbx_form_scaffold`                                                         |
| ui           | `dbx_ui_lookup`, `dbx_ui_search`, `dbx_ui_examples`                                                                                    |
| model        | `dbx_model_lookup`, `dbx_model_search`, `dbx_model_decode`, `dbx_model_validate`, `dbx_model_validate_api`, `dbx_model_validate_folder`, `dbx_model_store_scaffold` |
| storagefile  | `dbx_storagefile_model_validate_app`, `dbx_storagefile_model_list_app`, `dbx_storagefile_model_validate_folder`                        |
| notification | `dbx_notification_model_validate_app`, `dbx_notification_model_list_app`, `dbx_notification_model_validate_folder`                     |
| system       | `dbx_system_model_validate_folder`                                                                                                     |
| action       | `dbx_action_lookup`, `dbx_action_examples`, `dbx_action_scaffold`                                                                      |
| route        | `dbx_route_tree`, `dbx_route_lookup`, `dbx_route_search`                                                                               |
| filter       | `dbx_filter_lookup`, `dbx_filter_scaffold`                                                                                             |
| pipe         | `dbx_pipe_lookup`                                                                                                                      |
| artifact     | `dbx_artifact_scaffold`, `dbx_artifact_file_convention`                                                                                |

## Resources

| URI                                                  | Description                                            |
|------------------------------------------------------|--------------------------------------------------------|
| `dbx://forge-fields`                                 | Forge entry catalog                                    |
| `dbx://forge-fields/{slug}`                          | Single forge entry                                     |
| `dbx://forge-fields/produces/{produces}`             | Forge entries by output primitive                      |
| `dbx://forge-fields/tier/{tier}`                     | Forge entries by tier                                  |
| `dbx://forge-fields/array-output/{arrayOutput}`      | Forge entries by array-output flag                     |
| `dbx://firebase-models`                              | Firebase model catalog                                 |
| `dbx://firebase-models/{name}`                       | Single Firebase model                                  |
| `dbx://firebase-models/prefix/{prefix}`              | Firebase model by collection prefix                    |
| `dbx://firebase-models/subcollections/{parent}`      | Subcollection models nested under a parent identity    |

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
