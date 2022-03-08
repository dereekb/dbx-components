import { DbxActionSnackbarEventMakeConfig } from './action.snackbar.service';

export const DBX_ACTION_SNACKBAR_DEFAULTS: DbxActionSnackbarEventMakeConfig = {
  'create': {
    loading: {
      message: 'Creating...'
    },
    success: {
      button: 'Ok',
      message: 'Created'
    },
    error: {
      button: 'X',
      message: 'Create Failed'
    }
  },
  'save': {
    loading: {
      message: 'Saving...'
    },
    success: {
      button: 'Ok',
      message: 'Saved'
    },
    error: {
      button: 'X',
      message: 'Save Failed'
    }
  },
  'merge': {
    loading: {
      message: 'Merging...'
    },
    success: {
      button: 'Ok',
      message: 'Merged'
    },
    error: {
      button: 'X',
      message: 'Merge Failed'
    }
  },
  'delete': {
    loading: {
      message: 'Deleting...'
    },
    success: {
      button: 'Ok',
      message: 'Deleted'
    },
    error: {
      button: 'X',
      message: 'Delete Failed'
    }
  },
  'cancel': {
    loading: {
      message: 'Cancelling...'
    },
    success: {
      button: 'Ok',
      message: 'Canceled'
    },
    error: {
      button: 'X',
      message: 'Cancel Failed'
    }
  },
  'restore': {
    loading: {
      message: 'Restoring...'
    },
    success: {
      button: 'Ok',
      message: 'Restored'
    },
    error: {
      button: 'X',
      message: 'Restore Failed'
    }
  },
  'refresh': {
    loading: {
      message: 'Refreshing...'
    },
    success: {
      button: 'Ok',
      message: 'Refreshed'
    },
    error: {
      button: 'X',
      message: 'Refresh Failed'
    }
  }
};
