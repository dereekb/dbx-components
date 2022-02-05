
export interface ListItemSelectionState<T> {
  disabled?: boolean;
  selected?: boolean;
  value: T;
}

export interface ListSelectionState<T> {
  items: ListItemSelectionState<T>[];
}
