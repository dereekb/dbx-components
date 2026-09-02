# Pre-setup Checklist

You'll need to do the following before scaffolding a new project with `@dereekb/dbx-components-cli`.

> The `setup-project.sh` shell script this document used to describe has been retired. Everything it did now lives in the `dbx-components-cli setup` command group — see [`packages/dbx-components-cli/README.md`](../packages/dbx-components-cli/README.md) for the full command surface.

## Firebase

You'll need to setup a new Firebase project first (or rather one needs to exist by the time setup is run). You'll use this project name as part of the setup input.

For example, if you wanted to name your project `gethapier` but firebase only had `gethapierapp` and you setup your firebase project with that, then you run setup with the following:

`dbx-components-cli setup init gethapierapp gethapier getHapier 9300 gethapier-staging --dir ~/Desktop/gethapier`

The positionals are `<firebaseProjectId> [projectName] [codePrefix] [emulatorPort] [stagingProjectId]`, and `--dir` is the folder to create the project in (the workspace is created by `create-nx-workspace` in that folder's parent).

It is also recommended that you create a staging project too while you're setting up the production project.

### Firebase Firestore Setup

You'll need to setup a Firestore database for your project. You can do this by going to the Firebase Console and clicking on the Firestore database tab. The Project Overview may also say "Get started by adding Firebase to your app", for which you can create the web icon to get started.

You should type in your project's id as the App nickname for consistency. Also check the box for "Also setup Firebase Hosting for this app."

It is helpful to also copy/paste the setup details that are provided in the "Add Firebase SDK" step/section, as you'll copy/paste these details into the `base.ts` environment file.

### Billing Setup

Upgrade your billing account to the Blaze plan.

## After Setup

Read the `getting-started-checklist.md` file that setup writes to your new project's root for the next steps.

# Running Setup

```bash
# scaffold everything (create-nx-workspace + every module, in order)
dbx-components-cli setup init gethapierapp gethapier getHapier 9300 --dir ~/code/gethapier

# confirm every expected file was scaffolded (non-zero exit on a miss)
dbx-components-cli setup validate --dir ~/code/gethapier
```

`--dry-run` prints the whole file-write + shell-command plan without touching disk, which is worth doing first. To add the suite to a repo that is *already* an Nx workspace, skip the `workspace` module and run the others individually — see the CLI README.

The CLI is published as `@dereekb/dbx-components-cli`. When it isn't installed in the target repo, run it out of a dbx-components checkout:

```bash
npx -y tsx <dbx-components>/packages/dbx-components-cli/bin/dbx-components-cli.ts setup init … --dir <target>
```

# Per-integration Setup Scripts

After setup completes, the new project contains a `scripts/` folder with optional integration setup scripts. Each script reads project naming + paths from `dbx.setup.json` (also written by setup) so you don't have to re-enter them.

Available today:

- `node scripts/zoho/setup-zoho.mjs` — wires up Zoho Recruit / CRM / Sign NestJS modules and env vars. Use `--products=recruit,crm,sign --yes` to skip prompts.

To add a new integration script, drop it under `packages/dbx-components-cli/templates/scripts/<integration>/` in this repo and have it import `../_lib/setup-config.mjs` for project metadata. The whole `scripts/` subtree is scaffolded by the `integrations` module, so no per-file registration is needed — then add a bullet above.
