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

### Updating Projects
- the `ng-package.json` of sub-packages (e.g. `dbx-web/mapbox`) need to be updated to remove the `dest` property as it is now properly detected as invalid configuration. Leave the `dest` property on the parent package (e.g. `dbx-web`). This property apparently had no effect when used in the sub-package. Read more here: https://github.com/ng-packagr/ng-packagr/issues/2767
- Prior we also called run-commands to build each of the sub-packages independently, but this is no longer needed. In-fact, running them will cause our now updated config to behave as a non-sub package and output a dist folder into our src, which is not desired.

### Updating Packages
#### Mapbox
There have been several type changes to mapbox past version 3.0.1. dbx-web/mapbox has been updated to export these types that were removed/discarded. Your project may need to be updated if it used some of these types. The minimum version of mapbox allowed now is `v3.10`.

The `mapbox-gl` package has also been updated to use the `dist` folder instead of the `src` folder. Update the `styles` property in the build configuration to reference `mapbox-gl/dist/mapbox-gl.css` instead of `mapbox-gl/src/css/mapbox-gl.css`.

#### Firebase
- The function definition for `StreamDocsWithOnSnapshotFunctionParams.next` has been updated to only pass the value, and never pass undefined to match with the observable.

### NodeJS
v12 requires NodeJS version 22 or greater. This project is specifically targeting NodeJS 22.14.

You'll need to update the following:
- `Dockerfile`: Update FROM to use `node:22.14-bookworm`
- `package.json`: Update the `engines` to use `22`. Also update `@types/node` to `22.13.0`
- `circleci/config.yml`: Update the `cimg/node` version to `22.14`

### TypeScript
After the update Typescript was throwing errors related to the NodeJS types not being available while building Demo. Updated `tsconfig.json` for the project to include the following under `compilerOptions`: `"types": ["node"]`, or add `node` to the existing types. This is probably not necessary for projects importing dbx-components.
