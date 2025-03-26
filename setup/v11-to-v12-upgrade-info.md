# Steps
There are first 

## Migrations
We are jumping from Nx version 14 to version 16. It is important to run two independent migrations to ensure everything gets up to date properly.

### Migrate to Nx 17
Nx 17 release info is here:

https://nx.dev/blog/nx-17-release#better-typesafety-across-modules
https://nx.dev/blog/nx-17-2-release#nx-release-updates

First run the following:

```nx migrate 17```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` for the v11 of dbxcomponents.

#### package.json changes
- Updated all 3rd-party packages to their angular 17 supported version
- Replaced `angular-resize-event` -> `angular-resize-event-package`, as the original package is no longer maintained. See https://github.com/vdolek/angular-resize-event/issues/102

#### Run the migrations
- run ```npx nx migrate --run-migrations```. You can ignore the errors on the terminal that look like the following:
 
```Skipping migration for project demo. Unable to determine 'tsconfig.json' file in workspace config.```

The dbx-components library is unaffected by these migrations in particular. However, you can resolve the issue with the following steps describe in this issue:

https://github.com/nrwl/nx/issues/20172#issuecomment-1825783434

The command-line steps we used are as follow:

- run ```nx g @nx/plugin:plugin tools/my-plugin```. Just use the "my-plugin" name as-is, this is only temporary:
- run ```nx generate @nx/plugin:generator tools/my-plugin/src/generators/my-generator```
- copy the files from the issue/comment above
- run ```nx generate tools/my-plugin/src/generators/my-generator``` and answer "false" to the question
- run ```npx nx migrate --run-migrations```. This may take a while depending on the size of the project.

(After doing this step it is a good idea to commit the changes on git before continuing)
