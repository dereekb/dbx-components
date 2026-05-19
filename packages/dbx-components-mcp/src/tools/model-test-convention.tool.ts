/**
 * `dbx_model_test_convention` tool.
 *
 * Pure data lookup that answers **"where does a new test for model X go?"**
 * Mirrors {@link `dbx_artifact_file_convention`} — no AST, no file I/O.
 * Given a model-group name (and optionally an `apiDir`, `bucket`, and
 * `subgroups` chain) it renders the canonical spec-file path(s) and a
 * one-line summary of what belongs in each bucket.
 *
 * Companion to the heavier {@link `dbx_model_test_list_app`} which walks
 * an actual API app's `src/app/function/` tree to enumerate every existing
 * spec and surface drift. Use this tool when you just need the path; use
 * the list-app tool when you want an inventory + drift audit.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { buildCanonicalFilename, recommendBucketsForGroup, recommendSpecPath, type SpecBucketRecommendation } from './model-test-shared/index.js';

const API_DIR_PLACEHOLDER = '<apiDir>';

const ConventionArgsType = type({
  group: 'string',
  'apiDir?': 'string',
  'bucket?': "'crud' | 'scenario'",
  'subgroups?': 'string[]',
  'format?': "'markdown' | 'json'"
});

const TOOL: Tool = {
  name: 'dbx_model_test_convention',
  description: [
    'Answers **"where does a new test for model X go?"** Returns the canonical `<group>.crud[.<sub>].spec.ts` / `<group>.scenario[.<sub>].spec.ts` path(s) for the supplied model group as pure data — no disk walk. Use this for the common \'I have a model name, give me the path\' lookup; for an inventory + drift audit of an existing API app, use `dbx_model_test_list_app`.',
    '',
    'Canonical buckets:',
    '- `<group>.crud.spec.ts` — non-scenario tests of the CRUD function map (create/read/update/delete + permission/error paths).',
    '- `<group>.crud.<sub>[.<sub>...].spec.ts` — focused CRUD sub-bucket (e.g. `job.crud.requirement.spec.ts`).',
    '- `<group>.scenario.spec.ts` — multi-step scenario tests using fixture chains.',
    '- `<group>.scenario.<sub>[.<sub>...].spec.ts` — focused scenario sub-bucket (e.g. `job.scenario.requirement.worker.spec.ts`).',
    '',
    'Inputs:',
    '- `group`: required — the model-group folder name (e.g. `job`, `profile`).',
    '- `apiDir` (optional): substitutes for `<apiDir>` in the rendered path. Defaults to the literal placeholder.',
    '- `bucket` (optional): narrow the response to `crud` or `scenario`. Defaults to both.',
    '- `subgroups` (optional): chain segments rendered after the bucket (e.g. `["requirement", "worker"]` → `<group>.scenario.requirement.worker.spec.ts`). Only meaningful when `bucket` is supplied.',
    '- `format` (optional): `markdown` (default) or `json`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      group: { type: 'string', description: 'The model-group folder name (e.g. `job`).' },
      apiDir: { type: 'string', description: 'Optional. Substitutes for `<apiDir>` in the rendered path.' },
      bucket: { type: 'string', enum: ['crud', 'scenario'], description: 'Optional. Narrow to one bucket.' },
      subgroups: { type: 'array', items: { type: 'string' }, description: 'Optional. Subgroup chain rendered after the bucket.' },
      format: { type: 'string', enum: ['markdown', 'json'], description: 'Output format. Defaults to markdown.' }
    },
    required: ['group']
  }
};

interface ParsedConventionArgs {
  readonly group: string;
  readonly apiDir: string;
  readonly bucket: 'crud' | 'scenario' | undefined;
  readonly subgroups: readonly string[];
  readonly format: 'markdown' | 'json';
}

function parseArgs(rawArgs: unknown): ParsedConventionArgs | ToolResult {
  const parsed = ConventionArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  if (parsed.subgroups !== undefined && parsed.bucket === undefined) {
    return toolError('`subgroups` may only be supplied alongside an explicit `bucket`.');
  }
  return {
    group: parsed.group,
    apiDir: parsed.apiDir ?? API_DIR_PLACEHOLDER,
    bucket: parsed.bucket,
    subgroups: parsed.subgroups ?? [],
    format: parsed.format ?? 'markdown'
  };
}

interface ConventionRecommendation {
  readonly bucket: 'crud' | 'scenario';
  readonly label: string;
  readonly canonicalPath: string;
  readonly canonicalFilename: string;
  readonly summary: string;
}

interface ConventionReport {
  readonly group: string;
  readonly apiDir: string;
  readonly subgroups: readonly string[];
  readonly recommendations: readonly ConventionRecommendation[];
  readonly driftRules: readonly string[];
}

function buildReport(args: ParsedConventionArgs): ConventionReport {
  const recommendations: ConventionRecommendation[] = [];
  if (args.bucket === undefined) {
    const buckets = recommendBucketsForGroup({ apiDir: args.apiDir, group: args.group });
    for (const b of buckets) {
      recommendations.push(toRecommendation(args, b));
    }
  } else {
    const canonicalFilename = buildCanonicalFilename({ group: args.group, bucket: args.bucket, subgroups: args.subgroups });
    const canonicalPath = recommendSpecPath({ apiDir: args.apiDir, group: args.group, bucket: args.bucket, subgroups: args.subgroups });
    recommendations.push({
      bucket: args.bucket,
      label: args.bucket === 'crud' ? 'CRUD' : 'Scenario',
      canonicalPath,
      canonicalFilename,
      summary: bucketSummary(args.group, args.bucket)
    });
  }
  return {
    group: args.group,
    apiDir: args.apiDir,
    subgroups: args.subgroups,
    recommendations,
    driftRules: DRIFT_RULES
  };
}

function toRecommendation(args: ParsedConventionArgs, b: SpecBucketRecommendation): ConventionRecommendation {
  return {
    bucket: b.bucket,
    label: b.label,
    canonicalPath: b.canonicalPath,
    canonicalFilename: buildCanonicalFilename({ group: args.group, bucket: b.bucket, subgroups: [] }),
    summary: b.summary
  };
}

function bucketSummary(group: string, bucket: 'crud' | 'scenario'): string {
  if (bucket === 'crud') {
    return 'Non-scenario tests of the CRUD function map — create/read/update/delete + permission/error paths. Add focused buckets as `' + group + '.crud.<sub>.spec.ts`.';
  }
  return 'Multi-step scenarios using fixture chains (mirrors real workflows). Add focused buckets as `' + group + '.scenario.<sub>.spec.ts` (chain subgroups freely, e.g. `.scenario.requirement.worker.spec.ts`).';
}

const DRIFT_RULES: readonly string[] = ['`<group>.<sub>.crud.spec.ts` → rename to `<group>.crud.<sub>.spec.ts` (`crud` belongs directly after the group name).', '`<group>.<sub>.scenario.spec.ts` → rename to `<group>.scenario.<sub>.spec.ts` (`scenario` belongs directly after the group name).', '`<group>.<rest>.spec.ts` with no `crud` / `scenario` segment → add one (default to `scenario` when in doubt).'];

function formatMarkdown(report: ConventionReport): string {
  const lines: string[] = [];
  lines.push(`# Spec convention for \`${report.group}\``, '');
  lines.push(`Tests live under \`${report.apiDir}/src/app/function/${report.group}/\`. Canonical name segments:`, '');
  for (const rec of report.recommendations) {
    lines.push(`## ${rec.label} bucket`);
    lines.push('', `- **Path:** \`${rec.canonicalPath}\``);
    lines.push(`- **Filename:** \`${rec.canonicalFilename}\``);
    lines.push(`- ${rec.summary}`);
    lines.push('');
  }
  lines.push('## Drift rules', '');
  for (const rule of report.driftRules) {
    lines.push(`- ${rule}`);
  }
  lines.push('');
  lines.push('For an inventory + drift audit across an existing API app, run `dbx_model_test_list_app`. For naming-convention enforcement (errors / warnings), run `dbx_model_test_validate_app`.');
  return lines.join('\n').trimEnd();
}

function formatJson(report: ConventionReport): string {
  return JSON.stringify(report, null, 2);
}

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = parseArgs(rawArgs);
  if ('content' in parsed) {
    return parsed;
  }
  const report = buildReport(parsed);
  const text = parsed.format === 'json' ? formatJson(report) : formatMarkdown(report);
  return { content: [{ type: 'text', text }] };
}

export const MODEL_TEST_CONVENTION_TOOL: DbxTool = { definition: TOOL, run };
