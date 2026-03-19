const Store = require('electron-store');

class LastOpenedWorkspaces {
  constructor() {
    this.store = new Store({
      name: 'preferences',
      defaults: {}
    });
  }

  getAll() {
    return this.store.get('workspaces.lastOpenedWorkspaces', []);
  }

  add(workspacePath) {
    const workspaces = this.getAll();
    const filteredWorkspaces = workspaces.filter((w) => w !== workspacePath);
    filteredWorkspaces.unshift(workspacePath);
    this.store.set('workspaces.lastOpenedWorkspaces', filteredWorkspaces);
    return filteredWorkspaces;
  }

  remove(workspacePath) {
    const workspaces = this.getAll();
    const filteredWorkspaces = workspaces.filter((w) => w !== workspacePath);
    this.store.set('workspaces.lastOpenedWorkspaces', filteredWorkspaces);

    const lastActiveWorkspace = this.getLastActive();
    if (lastActiveWorkspace === workspacePath) {
      this.store.delete('workspaces.lastActiveWorkspace');
    }

    return filteredWorkspaces;
  }

  getLastActive() {
    return this.store.get('workspaces.lastActiveWorkspace', null);
  }

  setLastActive(workspacePath) {
    if (!workspacePath) {
      this.store.delete('workspaces.lastActiveWorkspace');
      return null;
    }

    this.store.set('workspaces.lastActiveWorkspace', workspacePath);
    this.add(workspacePath);
    return workspacePath;
  }
}

module.exports = LastOpenedWorkspaces;
