# dbx-components v12 to v13 upgrade info
- Update Nx to v22
- Update Angular to v21

## Migrations
We are jumping from Nx version 20 to version 22. It is important to run two independent migrations to ensure everything gets up to date properly.

### Migrate to Nx 22
Nx 22 release info is here:

https://nx.dev/blog/nx-22-release

First run the following:

```nx migrate 22```

This will setup the migration.json. It will also modify package.json, but it is best to manually check for the latest compatable versions of the dependencies. Compare the changes with the `package.json` for the v12 of dbxcomponents.

#### Run the migrations
- run ```npx nx migrate --run-migrations```. No errors were encountered while upgrading.

After migrating, you can run ```nx reset``` to reset the workspace's cache if you encounter issues with building.

#### Nx Agent Skills
You might find it useful to install the nx skills here if you are using AI agents like Claude:

https://nx.dev/blog/nx-ai-agent-skills

### Updating Packages
Check the updated `package.json` for more info.

#### Angular
- Updated to v21.0.0

#### Ngx Formly
- Updated to v7.1.0

#### Ngx Editor
- Replaced ```ngx-editor``` with ```@bobbyquantum/ngx-editor```, as the original package is no longer maintained. See https://github.com/bobbyquantum/ngx-editor

### @angular/fire

#### @jscutlery/semver
- Removed. Will be using Nx Release tools from now on since Nx has updating release tooling.
- See https://nx.dev/docs/features/manage-releases for more info. Updated release section will be below.
