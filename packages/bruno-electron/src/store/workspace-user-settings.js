const path = require('path');
const Store = require('electron-store');
const { generateUidBasedOnHash } = require('../utils/common');

class WorkspaceUserSettingsStore {
  constructor() {
    this.store = new Store({
      name: 'workspace-user-settings',
      clearInvalidConfig: true
    });
  }

  getWorkspaceKey(workspacePath) {
    const resolvedPath = path.resolve(workspacePath || '');
    return generateUidBasedOnHash(resolvedPath);
  }

  getWorkspaceState(workspacePath) {
    const key = this.getWorkspaceKey(workspacePath);
    const workspaces = this.store.get('workspaces', {});
    return workspaces[key] || {};
  }

  saveWorkspaceState(workspacePath, nextState) {
    const key = this.getWorkspaceKey(workspacePath);
    const workspaces = this.store.get('workspaces', {});
    workspaces[key] = {
      ...(workspaces[key] || {}),
      path: path.resolve(workspacePath || ''),
      ...nextState
    };
    this.store.set('workspaces', workspaces);
  }

  hasActiveGlobalEnvironmentUid(workspacePath) {
    const state = this.getWorkspaceState(workspacePath);
    return Object.prototype.hasOwnProperty.call(state, 'activeGlobalEnvironmentUid');
  }

  getActiveGlobalEnvironmentUid(workspacePath) {
    const state = this.getWorkspaceState(workspacePath);
    return state.activeGlobalEnvironmentUid ?? null;
  }

  setActiveGlobalEnvironmentUid(workspacePath, environmentUid) {
    this.saveWorkspaceState(workspacePath, {
      activeGlobalEnvironmentUid: environmentUid ?? null
    });
  }
}

const workspaceUserSettingsStore = new WorkspaceUserSettingsStore();

module.exports = {
  workspaceUserSettingsStore
};
