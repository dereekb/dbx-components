export interface DbxPresetFilterMenuConfig {
  unknownSelectionText?: string;
  /**
   * The icon to use for the filter, or false if no icon should be shown.
   */
  filterIcon?: string | false;
  /**
   * Whether or not to use the preset's icon if one is defined. If filterIcon is false, the icon will only appear when an item is selected.
   */
  usePresetIcon?: boolean;
}
