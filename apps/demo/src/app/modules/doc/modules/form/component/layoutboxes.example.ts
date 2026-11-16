import { type DbxLayoutBoxesAddOption, type DbxLayoutBoxesCanvasSize, type DbxLayoutBoxesCapConfig, type DbxLayoutBoxesItemStyleFunction, type DbxLayoutBoxesValue } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';

/**
 * The kind of thing a demo layout box holds.
 */
export type DocFormLayoutBoxKind = 'person' | 'thing';

/**
 * The demo layout box payload.
 *
 * The form output strips empty values, so both fields are read with a default.
 */
export interface DocFormLayoutBoxData {
  readonly kind: DocFormLayoutBoxKind;
  readonly label?: Maybe<string>;
}

/**
 * Colors person boxes primary and thing boxes tertiary.
 *
 * @param item - The box.
 * @returns The box style.
 */
export const docFormLayoutBoxStyle: DbxLayoutBoxesItemStyleFunction<DocFormLayoutBoxData> = (item) => {
  const kind = item.data?.kind ?? 'thing';
  return { color: kind === 'person' ? 'primary' : 'tertiary', cssClasses: `doc-layout-box-${kind}` };
};

export const DOC_FORM_LAYOUT_BOXES_ADD_OPTIONS: DbxLayoutBoxesAddOption<DocFormLayoutBoxData>[] = [
  { text: 'Add person', icon: 'person_add', box: { x: 0.4, y: 0.15, w: 0.2, h: 0.8 }, data: () => ({ kind: 'person' }) },
  { text: 'Add thing', icon: 'add_box', box: { x: 0.42, y: 0.55, w: 0.16, h: 0.25 }, data: () => ({ kind: 'thing' }) }
];

export const DOC_FORM_LAYOUT_BOXES_PEOPLE_CAP: DbxLayoutBoxesCapConfig<DocFormLayoutBoxData> = {
  max: 2,
  countFilter: (item) => item.data?.kind === 'person',
  warning: (count, max) => `${count} people: past the cap of ${max}.`
};

/**
 * A single "Add box" button that starts each new box at the default spot in the middle of the canvas.
 */
export const DOC_FORM_LAYOUT_BOXES_ADD_BOX_OPTIONS: DbxLayoutBoxesAddOption<DocFormLayoutBoxData>[] = [{ text: 'Add box', icon: 'add_box', data: () => ({ kind: 'thing' }) }];

/**
 * The custom box tones, cycled by box index. Each class sets `--dbx-layout-boxes-box-color` (see the demo `styles.scss`).
 */
export const DOC_FORM_LAYOUT_BOXES_TONE_CSS_CLASSES = ['doc-layout-box-tone-orange', 'doc-layout-box-tone-teal', 'doc-layout-box-tone-purple'];

/**
 * Gives each box a custom tone by index, through a CSS class instead of a `[dbxColor]` color.
 *
 * @param _item - The box.
 * @param index - The box index.
 * @returns The box style.
 */
export const docFormLayoutBoxToneStyle: DbxLayoutBoxesItemStyleFunction<DocFormLayoutBoxData> = (_item, index) => ({ cssClasses: DOC_FORM_LAYOUT_BOXES_TONE_CSS_CLASSES[index % DOC_FORM_LAYOUT_BOXES_TONE_CSS_CLASSES.length] });

/**
 * A canvas aspect the runtime canvas example can switch to.
 */
export interface DocFormLayoutBoxesCanvasPreset {
  readonly text: string;
  readonly canvas: DbxLayoutBoxesCanvasSize;
}

export const DOC_FORM_LAYOUT_BOXES_CANVAS_PRESETS: DocFormLayoutBoxesCanvasPreset[] = [
  { text: '16:9', canvas: { width: 16, height: 9 } },
  { text: '4:3', canvas: { width: 4, height: 3 } },
  { text: '1:1', canvas: { width: 1, height: 1 } },
  { text: '9:16', canvas: { width: 9, height: 16 } }
];

/**
 * Two seeded boxes for the demo.
 *
 * @returns A new sample value.
 */
export function docFormLayoutBoxesSampleValue(): DbxLayoutBoxesValue<DocFormLayoutBoxData> {
  return [
    { box: { x: 0.1, y: 0.2, w: 0.2, h: 0.75 }, data: { kind: 'person', label: 'Ada' } },
    { box: { x: 0.6, y: 0.5, w: 0.2, h: 0.3 }, data: { kind: 'thing', label: 'Lamp' } }
  ];
}

const DOC_FORM_LAYOUT_BOXES_SCENE_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90">',
  '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ec5ff"/><stop offset="1" stop-color="#e3f1ff"/></linearGradient></defs>',
  '<rect width="160" height="90" fill="url(#sky)"/>',
  '<circle cx="132" cy="18" r="9" fill="#ffd166"/>',
  '<rect y="64" width="160" height="26" fill="#7fb069"/>',
  '<rect x="96" y="40" width="40" height="26" fill="#c97b63"/>',
  '<polygon points="92,42 116,24 140,42" fill="#8d4f3a"/>',
  '</svg>'
].join('');

/**
 * A small inline picture used as the demo canvas background.
 */
export const DOC_FORM_LAYOUT_BOXES_SCENE_IMAGE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(DOC_FORM_LAYOUT_BOXES_SCENE_SVG)}`;
