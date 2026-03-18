const path = require('path');
const { execFile } = require('child_process');
const { ipcMain } = require('electron');
const simpleGit = require('simple-git');
const {
  cloneGitRepository,
  getCollectionGitRootPath,
  commitChanges,
  pushGitChanges,
  pullGitChanges,
  getAheadBehindCount
} = require('../utils/git');
const { createDirectory, removeDirectory } = require('../utils/filesystem');

const gitAutomationLocks = new Map();

const withRepoLock = (repoPath, task) => {
  const previousTask = gitAutomationLocks.get(repoPath) || Promise.resolve();

  const nextTask = previousTask
    .catch(() => {})
    .then(task)
    .finally(() => {
      if (gitAutomationLocks.get(repoPath) === nextTask) {
        gitAutomationLocks.delete(repoPath);
      }
    });

  gitAutomationLocks.set(repoPath, nextTask);
  return nextTask;
};

const getGitInstance = (gitRootPath) => simpleGit(gitRootPath);

const runGitCommand = (args, options = {}) => {
  return new Promise((resolve, reject) => {
    execFile('git', args, { windowsHide: false, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
        return;
      }

      resolve({
        stdout: stdout?.trim?.() || '',
        stderr: stderr?.trim?.() || ''
      });
    });
  });
};

const getGitHubAuthStatus = async () => {
  try {
    const versionResult = await runGitCommand(['credential-manager', '--version']);
    const accountsResult = await runGitCommand(['credential-manager', 'github', 'list']);
    const accounts = accountsResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      available: true,
      version: versionResult.stdout || null,
      accounts
    };
  } catch (error) {
    return {
      available: false,
      version: null,
      accounts: [],
      error: error.message
    };
  }
};

const loginToGitHub = async ({ force = false }) => {
  await runGitCommand(['credential-manager', 'configure']);

  const args = ['credential-manager', 'github', 'login', '--browser', '--url', 'https://github.com'];
  if (force) {
    args.push('--force');
  }

  return runGitCommand(args);
};

const logoutFromGitHub = async ({ account }) => {
  if (!account) {
    throw new Error('GitHub account is required');
  }

  return runGitCommand(['credential-manager', 'github', 'logout', account]);
};

const resolveGitRepo = async (repoPath) => {
  if (!repoPath) {
    throw new Error('Repository path is required');
  }

  const resolvedPath = path.resolve(repoPath);
  const gitRootPath = getCollectionGitRootPath(resolvedPath);

  if (!gitRootPath) {
    throw new Error('Selected folder is not inside a Git repository');
  }

  const git = getGitInstance(gitRootPath);
  const branchSummary = await git.branchLocal();
  const branch = branchSummary.current || null;

  let remoteUrl = null;
  try {
    remoteUrl = (await git.listRemote(['--get-url', 'origin'])).trim() || null;
  } catch (error) {}

  let authorName = null;
  let authorEmail = null;

  try {
    authorName = (await git.raw(['config', '--get', 'user.name'])).trim() || null;
  } catch (error) {}

  try {
    authorEmail = (await git.raw(['config', '--get', 'user.email'])).trim() || null;
  } catch (error) {}

  return {
    git,
    gitRootPath,
    branch,
    remoteUrl,
    authorName,
    authorEmail
  };
};

const buildCommitMessage = ({ trigger, workspaceName, authorName, context }) => {
  const scope = workspaceName ? `[${workspaceName}] ` : '';
  const actor = authorName || 'unknown-user';
  const changeCount = context?.changeCount || 1;

  let targetLabel = 'workspace changes';
  switch (context?.targetType) {
    case 'request':
      targetLabel = `request "${context.targetName}"`;
      break;
    case 'folder':
      targetLabel = `folder "${context.targetName}"`;
      break;
    case 'environment':
      targetLabel = `environment "${context.targetName}"`;
      break;
    case 'collection':
      targetLabel = `collection "${context.targetName}"`;
      break;
    case 'manual':
      targetLabel = 'manual sync';
      break;
    case 'application':
      targetLabel = 'application shutdown';
      break;
    case 'multiple':
      targetLabel = changeCount > 1 ? `${changeCount} changes` : 'multiple changes';
      break;
  }

  const triggerLabel = trigger === 'close'
    ? 'close'
    : trigger === 'createRequest'
      ? 'create'
      : 'save';

  const collectionSuffix = context?.collectionName ? ` in ${context.collectionName}` : '';
  return `${scope}${triggerLabel}: ${targetLabel}${collectionSuffix} by ${actor}`;
};

const commitAutomationChanges = async (mainWindow, payload) => {
  const repo = await resolveGitRepo(payload.repoPath);
  const git = repo.git;
  const status = await git.status();

  if (!status.files?.length) {
    return {
      committed: false,
      gitRootPath: repo.gitRootPath,
      branch: repo.branch,
      remoteUrl: repo.remoteUrl
    };
  }

  await git.add('.');

  const authorName = payload.commitAuthorName || repo.authorName || null;
  const authorEmail = payload.commitAuthorEmail || repo.authorEmail || null;

  if (authorName) {
    await git.addConfig('user.name', authorName, false, 'local');
  }
  if (authorEmail) {
    await git.addConfig('user.email', authorEmail, false, 'local');
  }

  const message = buildCommitMessage({
    trigger: payload.trigger,
    workspaceName: payload.workspaceName,
    authorName,
    context: payload.context
  });

  const commitResult = await commitChanges(repo.gitRootPath, message);

  let pushed = false;
  if (payload.autoPush && repo.remoteUrl && repo.branch) {
    try {
      await pushGitChanges(mainWindow, {
        gitRootPath: repo.gitRootPath,
        processUid: `git-sync-push-${Date.now()}`,
        remote: 'origin',
        remoteBranch: repo.branch
      });
      pushed = true;
    } catch (error) {
      throw new Error(`Commit created, but push failed: ${error.message}`);
    }
  }

  return {
    committed: true,
    pushed,
    message,
    branch: repo.branch,
    gitRootPath: repo.gitRootPath,
    remoteUrl: repo.remoteUrl,
    commitResult
  };
};

const pullAutomationChanges = async (mainWindow, payload) => {
  const repo = await resolveGitRepo(payload.repoPath);

  if (!repo.remoteUrl || !repo.branch) {
    return {
      skipped: true,
      reason: 'missing-remote-or-branch',
      gitRootPath: repo.gitRootPath
    };
  }

  const status = await repo.git.status();
  if (status.files?.length) {
    return {
      skipped: true,
      reason: 'working-tree-dirty',
      gitRootPath: repo.gitRootPath
    };
  }

  await repo.git.fetch('origin', repo.branch);

  const aheadBehind = await repo.git.raw(['rev-list', '--left-right', '--count', `HEAD...origin/${repo.branch}`]);
  const [aheadCountRaw, behindCountRaw] = aheadBehind.trim().split(/\s+/);
  const aheadCount = Number(aheadCountRaw || 0);
  const behindCount = Number(behindCountRaw || 0);

  if (!behindCount) {
    return {
      pulled: false,
      aheadCount,
      behindCount,
      gitRootPath: repo.gitRootPath,
      branch: repo.branch
    };
  }

  await pullGitChanges(mainWindow, {
    gitRootPath: repo.gitRootPath,
    processUid: `git-sync-pull-${Date.now()}`,
    remote: 'origin',
    remoteBranch: repo.branch,
    strategy: '--ff-only'
  });

  return {
    pulled: true,
    aheadCount,
    behindCount,
    gitRootPath: repo.gitRootPath,
    branch: repo.branch
  };
};

const getRepoSyncStatus = async (repoPath) => {
  const repo = await resolveGitRepo(repoPath);
  const status = await repo.git.status();
  const aheadBehind = await getAheadBehindCount(repo.gitRootPath).catch(() => ({ ahead: 0, behind: 0 }));

  return {
    gitRootPath: repo.gitRootPath,
    branch: repo.branch,
    remoteUrl: repo.remoteUrl,
    authorName: repo.authorName,
    authorEmail: repo.authorEmail,
    ahead: Number(aheadBehind?.ahead || 0),
    behind: Number(aheadBehind?.behind || 0),
    isDirty: Boolean(status.files?.length),
    changedFiles: status.files?.length || 0,
    current: status.current || repo.branch || null,
    tracking: status.tracking || null
  };
};

const pushAutomationChanges = async (mainWindow, payload) => {
  const repo = await resolveGitRepo(payload.repoPath);

  if (!repo.remoteUrl || !repo.branch) {
    return {
      skipped: true,
      reason: 'missing-remote-or-branch',
      gitRootPath: repo.gitRootPath
    };
  }

  if (payload.force) {
    await repo.git.push('origin', repo.branch, ['--force-with-lease']);
  } else {
    await pushGitChanges(mainWindow, {
      gitRootPath: repo.gitRootPath,
      processUid: `git-sync-push-${Date.now()}`,
      remote: 'origin',
      remoteBranch: repo.branch
    });
  }

  return {
    pushed: true,
    force: Boolean(payload.force),
    gitRootPath: repo.gitRootPath,
    branch: repo.branch,
    remoteUrl: repo.remoteUrl
  };
};

const forcePullAutomationChanges = async (mainWindow, payload) => {
  const repo = await resolveGitRepo(payload.repoPath);

  if (!repo.remoteUrl || !repo.branch) {
    return {
      skipped: true,
      reason: 'missing-remote-or-branch',
      gitRootPath: repo.gitRootPath
    };
  }

  await repo.git.fetch('origin', repo.branch);
  await repo.git.reset(['--hard', `origin/${repo.branch}`]);

  return {
    pulled: true,
    force: true,
    gitRootPath: repo.gitRootPath,
    branch: repo.branch,
    remoteUrl: repo.remoteUrl
  };
};

const registerGitIpc = (mainWindow) => {
  ipcMain.handle('renderer:clone-git-repository', async (event, { url, path, processUid }) => {
    let directoryCreated = false;
    try {
      await createDirectory(path);
      directoryCreated = true;
      await cloneGitRepository(mainWindow, { url, path, processUid });
      return 'Repository cloned successfully';
    } catch (error) {
      if (directoryCreated) {
        await removeDirectory(path);
      }
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:git-sync-validate-repo', async (_event, { repoPath }) => {
    try {
      const repo = await resolveGitRepo(repoPath);
      const githubAuth = await getGitHubAuthStatus();
      return {
        gitRootPath: repo.gitRootPath,
        branch: repo.branch,
        remoteUrl: repo.remoteUrl,
        authorName: repo.authorName,
        authorEmail: repo.authorEmail,
        githubAuth
      };
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:git-sync-github-status', async () => {
    const result = await getGitHubAuthStatus();
    if (!result.available && result.error) {
      return {
        ...result
      };
    }
    return result;
  });

  ipcMain.handle('renderer:git-sync-github-login', async (_event, payload) => {
    return loginToGitHub(payload || {});
  });

  ipcMain.handle('renderer:git-sync-github-logout', async (_event, payload) => {
    return logoutFromGitHub(payload || {});
  });

  ipcMain.handle('renderer:git-sync-status', async (_event, { repoPath }) => {
    return withRepoLock(path.resolve(repoPath || '.'), () => getRepoSyncStatus(repoPath));
  });

  ipcMain.handle('renderer:git-sync-commit', async (_event, payload) => {
    const repoPath = path.resolve(payload?.repoPath || '.');
    return withRepoLock(repoPath, () => commitAutomationChanges(mainWindow, payload));
  });

  ipcMain.handle('renderer:git-sync-pull', async (_event, payload) => {
    const repoPath = path.resolve(payload?.repoPath || '.');
    return withRepoLock(repoPath, () => payload?.force ? forcePullAutomationChanges(mainWindow, payload) : pullAutomationChanges(mainWindow, payload));
  });

  ipcMain.handle('renderer:git-sync-push', async (_event, payload) => {
    const repoPath = path.resolve(payload?.repoPath || '.');
    return withRepoLock(repoPath, () => pushAutomationChanges(mainWindow, payload || {}));
  });
};

module.exports = registerGitIpc;
