import {
  formatFiles,
  getProjects,
  ProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';

import { TemporaryBuildTargetGeneratorSchema } from './schema';

/** Unique tag to identify our change, must start with an `x-` as be XML schema. */
const SCHEMA_TAG = 'x-g-by-btf';
const TSCONFIG_TAG = 'x-g-by-btf-tsconfig';

function manipulateProjectTarget(
  tree: Tree,
  project: ProjectConfiguration,
  remove = false
) {
  const tsconfigPath = project.root + '/tsconfig.json';
  if (!tree.exists(tsconfigPath)) {
    console.error(`[${project.root}]`, `Can't find tsconfig.json`);
    return;
  }

  // Remove the build target or tsconfig if it exists and is tagged
  if (remove) {
    // Remove whole build target
    if (project.targets?.build && project.targets.build.options?.[SCHEMA_TAG]) {
      delete project.targets?.build;
      console.log(`[${project.root}]`, `Removed build target`);
    }
    // remove tsconfig only
    else if (project.targets?.build?.options?.[TSCONFIG_TAG]) {
      delete project.targets.build.options.tsConfig;
      delete project.targets.build.options[TSCONFIG_TAG];
      console.log(`[${project.root}]`, `Removed tsconfig.json`);
    }
    // Remove nothing
    else {
      console.log(
        `[${project.root}]`,
        `Skipping tsconfig removal, not tagged or does not exist`
      );
    }

    // Add build target or tsconfig if it doesn't exist and tag it for clean removal
  } else {
    project.targets = project.targets || {};

    // Build target exists already
    if (project.targets.build) {
      // Ts config mising
      if (!project.targets.build.options.tsConfig) {
        project.targets.build.options = {
          ...project.targets.build.options,
          tsConfig: tsconfigPath,
          [TSCONFIG_TAG]: true,
        };
        console.log(`[${project.root}]`, `Added tsconfig only`);
      } else {
        // Ts config exists, nothing to do
        console.log(`[${project.root}]`, `Skipping, already exists`);
      }
      // Add build target with tsconfig
    } else {
      project.targets = {
        build: {
          options: {
            tsConfig: tsconfigPath,
            [SCHEMA_TAG]: true,
          },
        },
        ...project.targets,
      };
      console.log(`[${project.root}]`, `Added build target`);
    }
  }
}

export async function temporaryBuildTarget(
  tree: Tree,
  options: TemporaryBuildTargetGeneratorSchema
) {
  const projects = getProjects(tree);

  for (const [name, project] of projects) {
    manipulateProjectTarget(tree, project, options.remove);
    updateProjectConfiguration(tree, name, project);
  }

  await formatFiles(tree);
}

export default temporaryBuildTarget;
