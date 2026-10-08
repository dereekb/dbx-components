import { type NotificationDeliveryMethod } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { indentLines, renderTable, truncate } from '../util/table';
import { cliNotificationDeliveryMethodLabel } from './notification.config';
import { type CliNotificationSettingsCellView, type CliNotificationTaskTypeView, type CliNotificationTaskTypesView, type CliNotificationTaskView, type CliNotificationTasksView, type CliNotificationTypeView, type CliNotificationTypesView, type CliNotificationUserSettingsView } from './notification.view';

const DESCRIPTION_MAX_LENGTH = 60;

function onOff(value: boolean): string {
  return value ? 'on' : 'off';
}

function formatDate(value: Maybe<Date>): string {
  return value ? value.toISOString() : '-';
}

function formatMethods(methods: readonly NotificationDeliveryMethod[]): string {
  return methods.length ? methods.map((x) => cliNotificationDeliveryMethodLabel(x)).join(', ') : 'none';
}

function renderTaskTypeHandler(task: Pick<CliNotificationTaskTypeView, 'hasHandler' | 'handlerFlowStepCount'>): string {
  let result = 'no';

  if (task.hasHandler) {
    result = task.handlerFlowStepCount == null ? 'yes' : `yes (${task.handlerFlowStepCount} flow steps)`;
  }

  return result;
}

function joinBlocks(blocks: readonly string[]): string {
  return blocks.join('\n\n') + '\n';
}

// MARK: Types
function typeDefaultCellText(type: Pick<CliNotificationTypeView, 'defaults'>, method: NotificationDeliveryMethod, forced: ReadonlySet<NotificationDeliveryMethod>): string {
  let result: string;

  if (forced.has(method)) {
    result = 'always';
  } else {
    const defaultValue = type.defaults[method];
    result = defaultValue == null ? '-' : onOff(defaultValue);
  }

  return result;
}

/**
 * Renders the `notification types` view: a table by default, one block per type when expanded.
 *
 * @param view - The view model.
 * @param expanded - Whether to render the full detail.
 * @returns The text, ending with a newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliNotificationTypesView(view: CliNotificationTypesView, expanded: boolean): string {
  const { deliveryMethods, types, hiddenCount } = view;
  const hiddenNote = hiddenCount > 0 ? ` (${hiddenCount} hidden, pass --all to include them)` : '';
  const forcedNote = types.some((x) => x.forcedDeliveryMethods?.length) ? '; always means the method is always on and cannot be changed' : '';
  const header = `${types.length} notification type${types.length === 1 ? '' : 's'}${hiddenNote}. Cells show each method's default; - means the user cannot configure it${forcedNote}.`;
  let result: string;

  if (expanded) {
    const blocks = types.map((type) => {
      const methods = type.deliveryMethods.map((method) => `${cliNotificationDeliveryMethodLabel(method)} (default ${onOff(type.defaults[method] ?? false)})`).join(', ');
      const lines = [
        `${type.type} — ${type.name}  [${type.group}]`,
        ...(type.description ? [indentLines(type.description, 2)] : []),
        `  notification model: ${type.notificationModel}${type.targetModel ? `   target model: ${type.targetModel}` : ''}`,
        `  methods: ${methods || 'none'}`,
        ...(type.forcedDeliveryMethods?.length ? [`  always on: ${formatMethods(type.forcedDeliveryMethods)}`] : []),
        ...(type.userConfigurableDeliveryMethods ? [`  declared configurable: ${formatMethods(type.userConfigurableDeliveryMethods)}`] : []),
        ...(type.onlySendToExplicitlyEnabledRecipients ? ['  opt-in: only sent to recipients that enabled it'] : []),
        ...(type.onlyTextExplicitlyEnabledRecipients === false ? ['  texts: sent unless the recipient turned them off'] : []),
        ...(type.hidden ? [`  hidden: ${type.hidden}`] : []),
        ...(type.template ? [`  template: ${type.template.symbolName}${type.template.factoryFunctionName ? ` (factory ${type.template.factoryFunctionName}, content for ${type.template.factoryContentDeliveryMethods.join(', ') || 'none'})` : ''}`, `  source: ${type.template.sourceFile}`] : [])
      ];

      return lines.join('\n');
    });

    result = joinBlocks([header, ...blocks]);
  } else {
    const rows = [
      ['TYPE', 'NAME', 'GROUP', ...deliveryMethods.map((x) => cliNotificationDeliveryMethodLabel(x).toUpperCase()), 'FLAGS'],
      ...types.map((type) => {
        const flags = [type.hidden ? 'hidden' : undefined, type.onlySendToExplicitlyEnabledRecipients ? 'opt-in' : undefined].filter((x) => x != null).join(',');
        const forced = new Set(type.forcedDeliveryMethods ?? []);
        return [type.type, truncate(type.name, DESCRIPTION_MAX_LENGTH), type.group, ...deliveryMethods.map((method) => typeDefaultCellText(type, method, forced)), flags];
      })
    ];

    result = `${header}\n\n${renderTable(rows)}\n`;
  }

  return result;
}

// MARK: Task Types
/**
 * Renders the `notification task-types` view: a table by default, one block per task type when expanded.
 *
 * @param view - The view model.
 * @param expanded - Whether to render the full detail.
 * @returns The text, ending with a newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliNotificationTaskTypesView(view: CliNotificationTaskTypesView, expanded: boolean): string {
  const { tasks } = view;
  const header = `${tasks.length} notification task type${tasks.length === 1 ? '' : 's'}.`;
  let result: string;

  if (expanded) {
    const blocks = tasks.map((task) =>
      [
        `${task.type} — ${task.symbolName}`,
        `  handler: ${renderTaskTypeHandler(task)}`,
        ...(task.dataInterfaceName ? [`  data: ${task.dataInterfaceName}`] : []),
        `  checkpoints: ${task.checkpoints.length ? task.checkpoints.map((x, i) => `${i + 1}. ${x}`).join('  ') : 'none'}`,
        ...(task.sourceFile ? [`  source: ${task.sourceFile}`] : [])
      ].join('\n')
    );

    result = joinBlocks([header, ...blocks]);
  } else {
    const rows = [['TYPE', 'SYMBOL', 'HANDLER', 'CHECKPOINTS'], ...tasks.map((task) => [task.type, task.symbolName, task.hasHandler ? 'yes' : 'no', task.checkpoints.join(' > ') || '-'])];
    result = `${header}\n\n${renderTable(rows)}\n`;
  }

  return result;
}

// MARK: User Settings
function settingsCellText(cell: Maybe<CliNotificationSettingsCellView>, expanded: boolean): string {
  let result: string;

  if (cell == null || cell.source === 'unavailable') {
    result = '-';
  } else if (cell.source === 'disabled') {
    result = 'off (dm)';
  } else if (cell.source === 'forced') {
    result = 'always';
  } else if (cell.source === 'explicit') {
    result = onOff(cell.effective);
  } else {
    result = `default (${onOff(cell.effective)})`;

    if (expanded && cell.source === 'master') {
      result = `all (${onOff(cell.effective)})`;
    }
  }

  return result;
}

/**
 * Renders the `model notificationUser settings` view: the account header plus the settings matrix, and with `expanded` the direct and
 * NotificationBox configs plus ready update payloads.
 *
 * @param view - The view model.
 * @param expanded - Whether to render the full detail.
 * @returns The text, ending with a newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliNotificationUserSettingsView(view: CliNotificationUserSettingsView, expanded: boolean): string {
  const { key, account, deliveryMethods, types } = view;
  const header = [
    `${key}${view.exists ? '' : ' (no NotificationUser yet, every type uses its default)'}`,
    `  email: ${account.email ?? '-'}   phone: ${account.phone ?? '-'}   flag: ${account.flag ?? '-'}`,
    `  off account-wide (gc.dm): ${account.disabledDeliveryMethods.length ? formatMethods(account.disabledDeliveryMethods) : 'none'}   stopped numbers (tso): ${account.textStoppedNumbers.join(', ') || 'none'}`
  ].join('\n');
  const rows = [['TYPE', 'NAME', ...deliveryMethods.map((x) => cliNotificationDeliveryMethodLabel(x).toUpperCase())], ...types.map((row) => [row.type, truncate(row.name, DESCRIPTION_MAX_LENGTH), ...deliveryMethods.map((method) => settingsCellText(row.cells[method], expanded))])];
  const hasForced = types.some((row) => Object.values(row.cells).some((cell) => cell?.source === 'forced'));
  const legend = `on/off: set by the user. default (x): not set, resolves to x. ${expanded ? 'all (x): set by the type-wide toggle (sd). ' : ''}off (dm): turned off account-wide. ${hasForced ? 'always: always on, cannot be changed. ' : ''}-: not configurable.`;
  const blocks = [header, `${renderTable(rows)}\n${legend}`];

  if (expanded) {
    const directTypes = Object.entries(view.directConfig ?? {});
    blocks.push(`Direct config (dc): ${directTypes.length ? '' : 'none'}${directTypes.map(([type, config]) => `\n  ${type}: ${JSON.stringify(config)}`).join('')}`);

    const boxes = view.boxes ?? [];
    const boxLines = boxes.map((box) => {
      const flags = [box.flag ? `flag: ${box.flag}` : undefined, box.removed ? 'removed' : undefined, box.needsSync ? 'needs sync' : undefined].filter((x) => x != null).join(', ');
      const typeLines = Object.entries(box.types).map(([type, cells]) => {
        const cellText = Object.entries(cells)
          .map(([method, cell]) => `${cliNotificationDeliveryMethodLabel(method as NotificationDeliveryMethod)}=${cell.value == null ? 'default' : onOff(cell.value)}${cell.overriddenBy == null ? '' : ` (gc decides: ${onOff(cell.overriddenBy)})`}`)
          .join(' ');
        return `    ${type}: ${cellText}`;
      });

      return [`  ${box.nb}${flags ? `  [${flags}]` : ''}`, ...typeLines].join('\n');
    });

    blocks.push(
      `NotificationBox configs (bc): ${boxes.length ? '' : 'none'}${boxLines.map((x) => `\n${x}`).join('')}`,
      [`Boxes (b): ${(view.boxIds ?? []).join(', ') || 'none'}`, `Excluded boxes (x): ${(view.excludedBoxes ?? []).join(', ') || 'none'}`, `Needs sync (ns): ${view.needsSync ? 'yes' : 'no'}`, `Health check (hc): ${view.healthCheck == null ? 'none' : JSON.stringify(view.healthCheck)}`].join('\n')
    );

    const howToChange = view.howToChange;

    if (howToChange) {
      const exampleLines = howToChange.examples.map((x) => `  ${x.description}\n    ${x.command}`);
      blocks.push([`How to change (${howToChange.command}):`, ...howToChange.notes.map((x) => `  - ${x}`), '', ...exampleLines].join('\n'));
    }
  }

  return joinBlocks(blocks);
}

// MARK: Tasks
function taskCheckpointsText(task: CliNotificationTaskView): string {
  const done = task.completedCheckpoints.length;
  let result: string;

  if (task.remainingCheckpoints == null) {
    result = done ? `${done} done` : '-';
  } else {
    result = `${done}/${done + task.remainingCheckpoints.length}${task.nextCheckpoint ? ` next: ${task.nextCheckpoint}` : ''}`;
  }

  return result;
}

function renderCliNotificationTaskBlock(task: CliNotificationTaskView): string {
  const lines = [
    `${task.key}`,
    `  type: ${task.type ?? '-'}   state: ${task.state}   unique: ${task.unique ? 'yes' : 'no'}`,
    `  send at (sat): ${formatDate(task.sendAt)}   created (cat): ${formatDate(task.createdAt)}`,
    `  attempts (a): ${task.attempts} of ${task.maxAttempts}${task.checkpointAttempts == null ? '' : `   on this checkpoint (at): ${task.checkpointAttempts}`}`,
    `  completed checkpoints (tpr): ${task.completedCheckpoints.join(', ') || 'none'}`,
    ...(task.remainingCheckpoints ? [`  remaining: ${task.remainingCheckpoints.join(', ') || 'none'}${task.nextCheckpoint ? `   next: ${task.nextCheckpoint}` : ''}`] : []),
    ...(task.checkpoints ? [`  flow: ${task.checkpoints.join(' > ') || 'none'}`] : []),
    ...(task.model ? [`  model (n.m): ${task.model}`] : []),
    ...(task.createdBy ? [`  created by (n.cb): ${task.createdBy}`] : []),
    ...(task.data == null ? [] : [`  data (n.d):\n${indentLines(JSON.stringify(task.data, null, 2), 4)}`]),
    ...task.warnings.map((x) => `  ! ${x}`)
  ];

  return lines.join('\n');
}

/**
 * Renders the `model notification tasks` view: a table by default, one block per task when expanded.
 *
 * @param view - The view model.
 * @param expanded - Whether to render the full detail.
 * @returns The text, ending with a newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliNotificationTasksView(view: CliNotificationTasksView, expanded: boolean): string {
  const { box, read, skippedNonTasks, tasks } = view;
  const header = `${box}: ${tasks.length} task${tasks.length === 1 ? '' : 's'} (read ${read} notification${read === 1 ? '' : 's'}${skippedNonTasks ? `, ${skippedNonTasks} not tasks` : ''}).`;
  let result: string;

  if (expanded) {
    result = joinBlocks([header, ...tasks.map((x) => renderCliNotificationTaskBlock(x))]);
  } else {
    const rows = [
      ['ID', 'TYPE', 'STATE', 'SEND AT', 'ATTEMPTS', 'CHECKPOINTS', 'FLAGS'],
      ...tasks.map((task) => {
        const flags = [task.unique ? 'unique' : undefined, task.knownType === false ? 'unknown-type' : undefined, task.warnings.length && task.knownType !== false ? 'warning' : undefined].filter((x) => x != null).join(',');
        return [task.key.split('/').pop() ?? task.key, task.type ?? '-', task.state, formatDate(task.sendAt), `${task.attempts}/${task.maxAttempts}`, taskCheckpointsText(task), flags];
      })
    ];

    result = `${header}\n\n${renderTable(rows)}\n`;
  }

  return result;
}

/**
 * Renders the `model notification task` view. The compact form is the task's summary block; the expanded form adds the flow, creator
 * and data.
 *
 * @param view - The view model.
 * @returns The text, ending with a newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliNotificationTaskView(view: CliNotificationTaskView): string {
  return renderCliNotificationTaskBlock(view) + '\n';
}
