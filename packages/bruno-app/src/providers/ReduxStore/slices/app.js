import { createSlice } from '@reduxjs/toolkit';
import filter from 'lodash/filter';
import brunoClipboard from 'utils/bruno-clipboard';
import toast from 'react-hot-toast';
import { addTab, focusTab } from './tabs';

let gitSyncTimeout = null;
let pendingGitSyncRun = null;

const initialState = {
  isDragging: false,
  idbConnectionReady: false,
  leftSidebarWidth: 250,
  sidebarCollapsed: false,
  screenWidth: 500,
  showHomePage: false,
  showApiSpecPage: false,
  showManageWorkspacePage: false,
  isEnvironmentSettingsModalOpen: false,
  isGlobalEnvironmentSettingsModalOpen: false,
  activePreferencesTab: 'general',
  preferences: {
    request: {
      sslVerification: true,
      customCaCertificate: {
        enabled: false,
        filePath: null
      },
      keepDefaultCaCertificates: {
        enabled: true
      },
      timeout: 0,
      oauth2: {
        useSystemBrowser: false
      }
    },
    font: {
      codeFont: 'default'
    },
    general: {
      defaultLocation: ''
    },
    onboarding: {
      hasLaunchedBefore: false,
      hasSeenWelcomeModal: true
    },
    autoSave: {
      enabled: false,
      interval: 1000
    },
    gitSync: {
      enabled: false,
      repoPath: '',
      autoPull: true,
      autoPush: true,
      pullInterval: 30000,
      commitDelay: 1500,
      commitAuthorName: '',
      commitAuthorEmail: '',
      commitTriggers: {
        onSave: true,
        onCreateRequest: false,
        onClose: false
      }
    },
    cache: {
      sslSession: {
        enabled: false
      }
    }
  },
  generateCode: {
    mainLanguage: 'Shell',
    library: 'curl',
    shouldInterpolate: true
  },
  cookies: [],
  taskQueue: [],
  gitOperationProgress: {},
  gitVersion: null,
  clipboard: {
    hasCopiedItems: false // Whether clipboard has Bruno data (for UI)
  },
  systemProxyVariables: {},
  envVarSearch: {
    collection: { query: '', expanded: false },
    global: { query: '', expanded: false }
  },
  isCreatingCollection: false,
  gitSyncStatus: {
    authAvailable: null,
    githubAccounts: [],
    authProviderVersion: null,
    authError: null,
    authInProgress: false,
    repoDetails: null,
    lastCommitAt: null,
    lastCommitMessage: null,
    lastCommitStatus: null,
    lastPullAt: null,
    lastPullStatus: null,
    lastPushAt: null,
    lastPushStatus: null,
    lastRunError: null,
    activeOperation: null,
    syncState: {
      ahead: 0,
      behind: 0,
      isDirty: false,
      changedFiles: 0,
      branch: null,
      tracking: null,
      current: null,
      lastFetchedAt: null
    }
  }
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    idbConnectionReady: (state) => {
      state.idbConnectionReady = true;
    },
    refreshScreenWidth: (state) => {
      state.screenWidth = window.innerWidth;
    },
    updateLeftSidebarWidth: (state, action) => {
      state.leftSidebarWidth = action.payload.leftSidebarWidth;
    },
    updateIsDragging: (state, action) => {
      state.isDragging = action.payload.isDragging;
    },
    showHomePage: (state) => {
      state.showHomePage = true;
      state.showApiSpecPage = false;
      state.showManageWorkspacePage = false;
    },
    hideHomePage: (state) => {
      state.showHomePage = false;
    },
    showManageWorkspacePage: (state) => {
      state.showManageWorkspacePage = true;
      state.showHomePage = false;
      state.showApiSpecPage = false;
    },
    hideManageWorkspacePage: (state) => {
      state.showManageWorkspacePage = false;
    },
    showApiSpecPage: (state) => {
      state.showHomePage = false;
      state.showApiSpecPage = true;
    },
    hideApiSpecPage: (state) => {
      state.showApiSpecPage = false;
    },
    updatePreferences: (state, action) => {
      state.preferences = action.payload;
    },
    updateActivePreferencesTab: (state, action) => {
      state.activePreferencesTab = action.payload.tab;
    },
    updateCookies: (state, action) => {
      state.cookies = action.payload;
    },
    insertTaskIntoQueue: (state, action) => {
      state.taskQueue.push(action.payload);
    },
    removeTaskFromQueue: (state, action) => {
      state.taskQueue = filter(state.taskQueue, (task) => task.uid !== action.payload.taskUid);
    },
    removeAllTasksFromQueue: (state) => {
      state.taskQueue = [];
    },
    updateSystemProxyVariables: (state, action) => {
      state.systemProxyVariables = action.payload;
    },
    updateGenerateCode: (state, action) => {
      state.generateCode = {
        ...state.generateCode,
        ...action.payload
      };
    },
    toggleSidebarCollapse: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    updateGitOperationProgress: (state, action) => {
      const { uid, data } = action.payload;
      if (!state.gitOperationProgress[uid]) {
        state.gitOperationProgress[uid] = { progressData: [] };
      }
      state.gitOperationProgress[uid].progressData.push(data);
    },
    removeGitOperationProgress: (state, action) => {
      delete state.gitOperationProgress[action.payload];
    },
    setGitVersion: (state, action) => {
      state.gitVersion = action.payload;
    },
    setClipboard: (state, action) => {
      // Update clipboard UI state
      state.clipboard.hasCopiedItems = action.payload.hasCopiedItems;
    },
    setEnvVarSearchQuery: (state, { payload: { context, query } }) => {
      if (!state.envVarSearch[context]) return;
      state.envVarSearch[context].query = query;
    },
    setEnvVarSearchExpanded: (state, { payload: { context, expanded } }) => {
      if (!state.envVarSearch[context]) return;
      state.envVarSearch[context].expanded = expanded;
    },
    setIsCreatingCollection: (state, action) => {
      state.isCreatingCollection = action.payload;
    },
    updateGitSyncStatus: (state, action) => {
      state.gitSyncStatus = {
        ...state.gitSyncStatus,
        ...action.payload
      };
    }
  },
  extraReducers: (builder) => {
    // Automatically hide special pages when any tab is added or focused
    builder
      .addCase(addTab, (state) => {
        state.showHomePage = false;
        state.showApiSpecPage = false;
        state.showManageWorkspacePage = false;
      })
      .addCase(focusTab, (state) => {
        state.showHomePage = false;
        state.showApiSpecPage = false;
        state.showManageWorkspacePage = false;
      });
  }
});

export const {
  idbConnectionReady,
  refreshScreenWidth,
  updateLeftSidebarWidth,
  updateIsDragging,
  showHomePage,
  hideHomePage,
  showManageWorkspacePage,
  hideManageWorkspacePage,
  showApiSpecPage,
  hideApiSpecPage,
  updatePreferences,
  updateActivePreferencesTab,
  updateCookies,
  insertTaskIntoQueue,
  removeTaskFromQueue,
  removeAllTasksFromQueue,
  updateSystemProxyVariables,
  updateGenerateCode,
  toggleSidebarCollapse,
  updateGitOperationProgress,
  removeGitOperationProgress,
  setGitVersion,
  setClipboard,
  setEnvVarSearchQuery,
  setEnvVarSearchExpanded,
  setIsCreatingCollection,
  updateGitSyncStatus
} = appSlice.actions;

export const savePreferences = (preferences) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;

    ipcRenderer
      .invoke('renderer:save-preferences', preferences)
      .then(() => dispatch(updatePreferences(preferences)))
      .then(resolve)
      .catch(reject);
  });
};

const gitTriggerToPreferenceKey = {
  save: 'onSave',
  createRequest: 'onCreateRequest',
  close: 'onClose'
};

const getActiveWorkspace = (state) => {
  const activeWorkspaceUid = state.workspaces?.activeWorkspaceUid;
  return state.workspaces?.workspaces?.find((workspace) => workspace.uid === activeWorkspaceUid) || null;
};

const mergeGitSyncContext = (existingContext, incomingContext) => {
  if (!existingContext) {
    return {
      ...incomingContext,
      changeCount: incomingContext?.changeCount || 1
    };
  }

  const existingCount = existingContext.changeCount || 1;
  const incomingCount = incomingContext?.changeCount || 1;

  if (
    existingContext.targetType === incomingContext?.targetType
    && existingContext.targetName === incomingContext?.targetName
    && existingContext.collectionName === incomingContext?.collectionName
  ) {
    return {
      ...existingContext,
      changeCount: existingCount + incomingCount
    };
  }

  return {
    targetType: 'multiple',
    targetName: null,
    collectionName: existingContext.collectionName || incomingContext?.collectionName || null,
    changeCount: existingCount + incomingCount
  };
};

const shouldRunGitTrigger = (gitSyncPreferences, trigger) => {
  if (!gitSyncPreferences?.enabled || !gitSyncPreferences?.repoPath) {
    return false;
  }

  const preferenceKey = gitTriggerToPreferenceKey[trigger];
  if (!preferenceKey) {
    return true;
  }

  return Boolean(gitSyncPreferences.commitTriggers?.[preferenceKey]);
};

export const runGitAutomationTrigger = ({ trigger = 'save', context = null, silent = true } = {}) => async (_dispatch, getState) => {
  const state = getState();
  const gitSyncPreferences = state.app.preferences?.gitSync;

  if (!shouldRunGitTrigger(gitSyncPreferences, trigger)) {
    return { skipped: true, reason: 'disabled' };
  }

  const activeWorkspace = getActiveWorkspace(state);

  try {
    _dispatch(updateGitSyncStatus({
      activeOperation: 'commit'
    }));
    const result = await window.ipcRenderer.invoke('renderer:git-sync-commit', {
      repoPath: gitSyncPreferences.repoPath,
      trigger,
      autoPush: gitSyncPreferences.autoPush !== false,
      commitAuthorName: gitSyncPreferences.commitAuthorName || null,
      commitAuthorEmail: gitSyncPreferences.commitAuthorEmail || null,
      workspaceName: activeWorkspace?.name || null,
      context
    });
    _dispatch(updateGitSyncStatus({
      repoDetails: result?.gitRootPath ? {
        gitRootPath: result.gitRootPath,
        branch: result.branch,
        remoteUrl: result.remoteUrl
      } : undefined,
      lastCommitAt: result?.committed ? new Date().toISOString() : undefined,
      lastCommitMessage: result?.committed ? result.message : undefined,
      lastCommitStatus: result?.committed ? 'committed' : 'no_changes',
      lastPushAt: result?.pushed ? new Date().toISOString() : undefined,
      lastPushStatus: result?.committed ? (result.pushed ? 'pushed' : 'not_pushed') : undefined,
      lastRunError: null,
      activeOperation: null
    }));
    _dispatch(refreshGitSyncStatus({ silent: true })).catch(() => {});
    return result;
  } catch (error) {
    _dispatch(updateGitSyncStatus({
      lastRunError: error?.message || 'Git automation failed',
      activeOperation: null
    }));
    if (!silent) {
      toast.error(error?.message || 'Git automation failed');
    }
    throw error;
  }
};

export const scheduleGitAutomationTrigger = ({ trigger = 'save', context = null, silent = true } = {}) => (dispatch, getState) => {
  const state = getState();
  const gitSyncPreferences = state.app.preferences?.gitSync;

  if (!shouldRunGitTrigger(gitSyncPreferences, trigger)) {
    return Promise.resolve({ skipped: true, reason: 'disabled' });
  }

  const commitDelay = Number(gitSyncPreferences.commitDelay ?? 0);

  if (commitDelay <= 0) {
    return dispatch(runGitAutomationTrigger({ trigger, context, silent }));
  }

  pendingGitSyncRun = {
    trigger,
    silent,
    context: mergeGitSyncContext(pendingGitSyncRun?.context, context)
  };

  clearTimeout(gitSyncTimeout);
  gitSyncTimeout = setTimeout(() => {
    const nextRun = pendingGitSyncRun;
    pendingGitSyncRun = null;
    gitSyncTimeout = null;

    if (nextRun) {
      dispatch(runGitAutomationTrigger(nextRun)).catch(() => {});
    }
  }, commitDelay);

  return Promise.resolve({ scheduled: true });
};

export const flushGitAutomationTrigger = ({ silent = true } = {}) => (dispatch) => {
  if (!pendingGitSyncRun) {
    return Promise.resolve({ flushed: false });
  }

  const nextRun = {
    ...pendingGitSyncRun,
    silent
  };

  pendingGitSyncRun = null;
  clearTimeout(gitSyncTimeout);
  gitSyncTimeout = null;

  return dispatch(runGitAutomationTrigger(nextRun));
};

export const runGitAutomationPull = ({ silent = true, reason = 'manual', force = false } = {}) => async (_dispatch, getState) => {
  const state = getState();
  const gitSyncPreferences = state.app.preferences?.gitSync;

  if (!gitSyncPreferences?.enabled || !gitSyncPreferences?.repoPath) {
    return { skipped: true, reason: 'disabled' };
  }

  if (reason === 'poll' && !gitSyncPreferences.autoPull) {
    return { skipped: true, reason: 'disabled' };
  }

  try {
    _dispatch(updateGitSyncStatus({
      activeOperation: force ? 'force-pull' : 'pull'
    }));
    const result = await window.ipcRenderer.invoke('renderer:git-sync-pull', {
      repoPath: gitSyncPreferences.repoPath,
      reason,
      force
    });
    _dispatch(updateGitSyncStatus({
      lastPullAt: new Date().toISOString(),
      lastPullStatus: result?.pulled ? 'pulled' : result?.skipped ? result.reason : 'up_to_date',
      repoDetails: result?.gitRootPath ? {
        gitRootPath: result.gitRootPath,
        branch: result.branch,
        remoteUrl: state.app.gitSyncStatus?.repoDetails?.remoteUrl || state.app.gitSyncStatus?.repoDetails?.remote
      } : undefined,
      lastRunError: null,
      activeOperation: null
    }));
    _dispatch(refreshGitSyncStatus({ silent: true })).catch(() => {});
    return result;
  } catch (error) {
    _dispatch(updateGitSyncStatus({
      lastPullAt: new Date().toISOString(),
      lastPullStatus: 'error',
      lastRunError: error?.message || 'Git pull failed',
      activeOperation: null
    }));
    if (!silent) {
      toast.error(error?.message || 'Git pull failed');
    }
    throw error;
  }
};

export const refreshGitSyncStatus = ({ silent = false } = {}) => async (dispatch, getState) => {
  const state = getState();
  const gitSyncPreferences = state.app.preferences?.gitSync;

  if (!gitSyncPreferences?.enabled || !gitSyncPreferences?.repoPath) {
    dispatch(updateGitSyncStatus({
      syncState: {
        ahead: 0,
        behind: 0,
        isDirty: false,
        changedFiles: 0,
        branch: null,
        tracking: null,
        current: null,
        lastFetchedAt: new Date().toISOString()
      }
    }));
    return { skipped: true, reason: 'disabled' };
  }

  try {
    const result = await window.ipcRenderer.invoke('renderer:git-sync-status', {
      repoPath: gitSyncPreferences.repoPath
    });

    dispatch(updateGitSyncStatus({
      repoDetails: result?.gitRootPath ? {
        gitRootPath: result.gitRootPath,
        branch: result.branch,
        remoteUrl: result.remoteUrl
      } : undefined,
      syncState: {
        ahead: Number(result?.ahead || 0),
        behind: Number(result?.behind || 0),
        isDirty: Boolean(result?.isDirty),
        changedFiles: Number(result?.changedFiles || 0),
        branch: result?.branch || null,
        tracking: result?.tracking || null,
        current: result?.current || null,
        lastFetchedAt: new Date().toISOString()
      },
      lastRunError: null
    }));
    return result;
  } catch (error) {
    dispatch(updateGitSyncStatus({
      lastRunError: error?.message || 'Failed to refresh Git sync status'
    }));
    if (!silent) {
      toast.error(error?.message || 'Failed to refresh Git sync status');
    }
    throw error;
  }
};

export const runGitAutomationPush = ({ silent = true, force = false } = {}) => async (dispatch, getState) => {
  const state = getState();
  const gitSyncPreferences = state.app.preferences?.gitSync;
  const activeWorkspace = getActiveWorkspace(state);

  if (!gitSyncPreferences?.enabled || !gitSyncPreferences?.repoPath) {
    return { skipped: true, reason: 'disabled' };
  }

  try {
    dispatch(updateGitSyncStatus({
      activeOperation: force ? 'force-push' : 'push'
    }));
    const result = await window.ipcRenderer.invoke('renderer:git-sync-push', {
      repoPath: gitSyncPreferences.repoPath,
      commitAuthorName: gitSyncPreferences.commitAuthorName || null,
      commitAuthorEmail: gitSyncPreferences.commitAuthorEmail || null,
      workspaceName: activeWorkspace?.name || null,
      context: {
        targetType: 'manual',
        targetName: 'status-bar push',
        collectionName: null
      },
      force
    });

    dispatch(updateGitSyncStatus({
      lastCommitAt: result?.committed ? new Date().toISOString() : state.app.gitSyncStatus?.lastCommitAt,
      lastCommitMessage: result?.committed ? result.message : state.app.gitSyncStatus?.lastCommitMessage,
      lastCommitStatus: result?.committed ? 'committed' : state.app.gitSyncStatus?.lastCommitStatus,
      lastPushAt: new Date().toISOString(),
      lastPushStatus: result?.pushed ? (force ? 'force_pushed' : 'pushed') : result?.reason || 'idle',
      repoDetails: result?.gitRootPath ? {
        gitRootPath: result.gitRootPath,
        branch: result.branch,
        remoteUrl: result.remoteUrl
      } : undefined,
      lastRunError: null,
      activeOperation: null
    }));
    dispatch(refreshGitSyncStatus({ silent: true })).catch(() => {});
    return result;
  } catch (error) {
    dispatch(updateGitSyncStatus({
      lastPushAt: new Date().toISOString(),
      lastPushStatus: 'error',
      lastRunError: error?.message || 'Git push failed',
      activeOperation: null
    }));
    if (!silent) {
      toast.error(error?.message || 'Git push failed');
    }
    throw error;
  }
};

export const runGitAutomationSync = ({ silent = true } = {}) => async (dispatch, getState) => {
  const state = getState();
  const gitSyncPreferences = state.app.preferences?.gitSync;

  if (!gitSyncPreferences?.enabled || !gitSyncPreferences?.repoPath) {
    return { skipped: true, reason: 'disabled' };
  }

  const summary = {
    refreshed: false,
    pulled: false,
    pushed: false,
    pullResult: null,
    pushResult: null,
    finalStatus: null
  };

  const initialStatus = await dispatch(refreshGitSyncStatus({ silent }));
  summary.refreshed = true;

  if (Number(initialStatus?.behind || 0) > 0) {
    summary.pullResult = await dispatch(runGitAutomationPull({ silent: true, reason: 'manual', force: false }));
    summary.pulled = Boolean(summary.pullResult?.pulled);
  }

  const afterPullStatus = await dispatch(refreshGitSyncStatus({ silent: true }));
  summary.finalStatus = afterPullStatus;

  const hasLocalWorkToPush = Boolean(afterPullStatus?.isDirty) || Number(afterPullStatus?.ahead || 0) > 0;
  if (hasLocalWorkToPush) {
    summary.pushResult = await dispatch(runGitAutomationPush({ silent: true, force: false }));
    summary.pushed = Boolean(summary.pushResult?.pushed);
    summary.finalStatus = await dispatch(refreshGitSyncStatus({ silent: true }));
  }

  return summary;
};

export const getGitAutomationRepoDetails = (repoPath) => async (dispatch) => {
  const details = await window.ipcRenderer.invoke('renderer:git-sync-validate-repo', { repoPath });
  dispatch(updateGitSyncStatus({
    repoDetails: details,
    authAvailable: details?.githubAuth?.available ?? undefined,
    githubAccounts: details?.githubAuth?.accounts,
    authProviderVersion: details?.githubAuth?.version ?? undefined,
    authError: details?.githubAuth?.error ?? null,
    lastRunError: null
  }));
  return details;
};

export const getGitHubAuthStatus = () => async (dispatch) => {
  const result = await window.ipcRenderer.invoke('renderer:git-sync-github-status');
  dispatch(updateGitSyncStatus({
    authAvailable: result.available,
    githubAccounts: result.accounts || [],
    authProviderVersion: result.version || null,
    authError: null
  }));
  return result;
};

export const loginGitHubForGitSync = ({ force = false } = {}) => async (dispatch) => {
  dispatch(updateGitSyncStatus({
    authInProgress: true,
    authError: null
  }));

  try {
    const result = await window.ipcRenderer.invoke('renderer:git-sync-github-login', { force });
    await dispatch(getGitHubAuthStatus());
    dispatch(updateGitSyncStatus({
      authInProgress: false,
      lastRunError: null
    }));
    return result;
  } catch (error) {
    dispatch(updateGitSyncStatus({
      authInProgress: false,
      authError: error?.message || 'GitHub login failed',
      lastRunError: error?.message || 'GitHub login failed'
    }));
    throw error;
  }
};

export const logoutGitHubForGitSync = (account) => async (dispatch) => {
  dispatch(updateGitSyncStatus({
    authInProgress: true,
    authError: null
  }));

  try {
    const result = await window.ipcRenderer.invoke('renderer:git-sync-github-logout', { account });
    await dispatch(getGitHubAuthStatus());
    dispatch(updateGitSyncStatus({
      authInProgress: false,
      lastRunError: null
    }));
    return result;
  } catch (error) {
    dispatch(updateGitSyncStatus({
      authInProgress: false,
      authError: error?.message || 'GitHub logout failed',
      lastRunError: error?.message || 'GitHub logout failed'
    }));
    throw error;
  }
};

export const deleteCookiesForDomain = (domain) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;

    ipcRenderer.invoke('renderer:delete-cookies-for-domain', domain).then(resolve).catch(reject);
  });
};

export const deleteCookie = (domain, path, cookieKey) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;

    ipcRenderer.invoke('renderer:delete-cookie', domain, path, cookieKey).then(resolve).catch(reject);
  });
};

export const addCookie = (domain, cookie) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;

    ipcRenderer.invoke('renderer:add-cookie', domain, cookie).then(resolve).catch(reject);
  });
};

export const modifyCookie = (domain, oldCookie, cookie) => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;

    ipcRenderer.invoke('renderer:modify-cookie', domain, oldCookie, cookie).then(resolve).catch(reject);
  });
};

export const getParsedCookie = (cookieStr) => () => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;
    ipcRenderer.invoke('renderer:get-parsed-cookie', cookieStr).then(resolve).catch(reject);
  });
};

export const createCookieString = (cookieObj) => () => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;
    ipcRenderer.invoke('renderer:create-cookie-string', cookieObj).then(resolve).catch(reject);
  });
};

export const completeQuitFlow = () => (dispatch, getState) => {
  const { ipcRenderer } = window;
  return dispatch(flushGitAutomationTrigger({ silent: true }))
    .catch(() => {})
    .then(() => dispatch(runGitAutomationTrigger({
      trigger: 'close',
      context: {
        targetType: 'application',
        targetName: 'Bruno'
      },
      silent: true
    })).catch(() => {}))
    .then(() => ipcRenderer.invoke('main:complete-quit-flow'));
};

export const copyRequest = (item) => (dispatch, getState) => {
  brunoClipboard.write(item);
  dispatch(setClipboard({ hasCopiedItems: true }));
  return Promise.resolve();
};

export const getSystemProxyVariables = () => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;
    ipcRenderer.invoke('renderer:get-system-proxy-variables')
      .then((variables) => {
        dispatch(updateSystemProxyVariables(variables));
        return variables;
      })
      .then(resolve).catch(reject);
  });
};

export const refreshSystemProxy = () => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;
    ipcRenderer.invoke('renderer:refresh-system-proxy')
      .then((variables) => {
        dispatch(updateSystemProxyVariables(variables));
        return variables;
      })
      .then(resolve).catch(reject);
  });
};

export const clearHttpHttpsAgentCache = () => () => {
  return new Promise((resolve, reject) => {
    const { ipcRenderer } = window;
    ipcRenderer.invoke('renderer:clear-http-https-agent-cache').then(resolve).catch(reject);
  });
};

export default appSlice.reducer;
