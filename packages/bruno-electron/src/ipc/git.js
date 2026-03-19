const path = require('path');
const fs = require('fs');
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
const {
  readWorkspaceConfig,
  generateYamlContent,
  writeWorkspaceFileAtomic
} = require('../utils/workspace-config');

const gitAutomationLocks = new Map();
let cachedCredentialManagerCommand = null;
const UNSUPPORTED_GITHUB_AUTH_PATTERNS = [
  /Required command was not provided/i,
  /Unrecognized command or argument 'github'/i,
  /Unrecognized command or argument 'login'/i,
  /Unrecognized command or argument '--browser'/i,
  /Unrecognized command or argument '--url'/i
];
const BRUNO_ENV_GITIGNORE_START = '# Bruno local global environments';
const BRUNO_ENV_GITIGNORE_END = '# End Bruno local global environments';
const BRUNO_ENV_README_CONTENT = `# Bruno local global environments

This directory stores Bruno global environments for the current user.

How to use it:
- create your own \`.yml\` environment files here from Bruno
- fill in local values such as \`SN\`, tokens, hosts, and secrets
- do not commit these \`.yml\` files

Git rules:
- \`**/environments/*.yml\` is ignored on purpose
- this keeps every user's values local
- only this README stays in the repository as documentation
`;

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

const upsertManagedBlock = (content, block) => {
  const normalizedContent = content || '';
  const blockRegex = new RegExp(`${BRUNO_ENV_GITIGNORE_START}[\\s\\S]*?${BRUNO_ENV_GITIGNORE_END}\\n?`, 'm');
  const trimmedContent = normalizedContent.replace(/\n+$/g, '');

  if (blockRegex.test(trimmedContent)) {
    return `${trimmedContent.replace(blockRegex, block)}\n`;
  }

  const separator = trimmedContent ? '\n\n' : '';
  return `${trimmedContent}${separator}${block}\n`;
};

const ensureRepoGlobalEnvironmentSetup = async (repoPath) => {
  const repo = await resolveGitRepo(repoPath);
  const repoRootPath = repo.gitRootPath;
  const workspaceRootPath = path.resolve(repoPath);
  let changed = false;

  const gitignorePath = path.join(repoRootPath, '.gitignore');
  const managedGitignoreBlock = [
    BRUNO_ENV_GITIGNORE_START,
    '**/environments/*.yml',
    '!**/environments/README.md',
    BRUNO_ENV_GITIGNORE_END
  ].join('\n');
  const currentGitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const nextGitignore = upsertManagedBlock(currentGitignore, managedGitignoreBlock);
  if (nextGitignore !== currentGitignore) {
    fs.writeFileSync(gitignorePath, nextGitignore, 'utf8');
    changed = true;
  }

  const environmentsDir = path.join(workspaceRootPath, 'environments');
  if (!fs.existsSync(environmentsDir)) {
    fs.mkdirSync(environmentsDir, { recursive: true });
    changed = true;
  }

  const environmentReadmePath = path.join(environmentsDir, 'README.md');
  const currentEnvironmentReadme = fs.existsSync(environmentReadmePath) ? fs.readFileSync(environmentReadmePath, 'utf8') : '';
  if (currentEnvironmentReadme !== BRUNO_ENV_README_CONTENT) {
    fs.writeFileSync(environmentReadmePath, BRUNO_ENV_README_CONTENT, 'utf8');
    changed = true;
  }

  const workspaceRelativePath = path.relative(repoRootPath, workspaceRootPath).split(path.sep).join('/');
  const trackedEnvironmentGlob = workspaceRelativePath
    ? `${workspaceRelativePath}/environments/*.yml`
    : 'environments/*.yml';
  const trackedEnvironmentFilesRaw = await repo.git.raw(['ls-files', '--', trackedEnvironmentGlob]);
  const trackedEnvironmentFiles = trackedEnvironmentFilesRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (trackedEnvironmentFiles.length) {
    await repo.git.raw(['rm', '--cached', '--', ...trackedEnvironmentFiles]);
    changed = true;
  }

  const workspaceFilePath = path.join(workspaceRootPath, 'workspace.yml');
  if (fs.existsSync(workspaceFilePath)) {
    try {
      const workspaceConfig = readWorkspaceConfig(workspaceRootPath);
      if (workspaceConfig.activeEnvironmentUid) {
        delete workspaceConfig.activeEnvironmentUid;
        const yamlOutput = generateYamlContent(workspaceConfig);
        await writeWorkspaceFileAtomic(workspaceRootPath, yamlOutput);
        changed = true;
      }
    } catch (error) {}
  }

  return {
    ...repo,
    repoPrepared: changed,
    trackedEnvironmentFilesRemoved: trackedEnvironmentFiles.length
  };
};

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

const getCredentialManagerCommand = async () => {
  if (cachedCredentialManagerCommand) {
    return cachedCredentialManagerCommand;
  }

  const candidateCommands = ['credential-manager', 'credential-manager-core'];

  for (const command of candidateCommands) {
    try {
      await runGitCommand([command, '--version']);
      cachedCredentialManagerCommand = command;
      return command;
    } catch (error) {}
  }

  throw new Error(
    'Git Credential Manager is not available. Install Git Credential Manager and try again.'
  );
};

const runCredentialManagerCommand = async (args, options = {}) => {
  const credentialManagerCommand = await getCredentialManagerCommand();
  return runGitCommand([credentialManagerCommand, ...args], options);
};

const tryRunCredentialManagerCommand = async (args, options = {}) => {
  try {
    const result = await runCredentialManagerCommand(args, options);
    return {
      ok: true,
      result
    };
  } catch (error) {
    return {
      ok: false,
      error
    };
  }
};

const isUnsupportedGitHubAuthCommandError = (error) => {
  const message = error?.message || '';
  return UNSUPPORTED_GITHUB_AUTH_PATTERNS.some((pattern) => pattern.test(message));
};

const ensureCredentialManagerConfigured = async () => {
  const configurationCommands = [['configure'], ['install'], ['deploy']];
  let lastError = null;

  for (const args of configurationCommands) {
    const result = await tryRunCredentialManagerCommand(args);
    if (result.ok) {
      return {
        configured: true,
        method: args[0]
      };
    }
    lastError = result.error;
  }

  return {
    configured: false,
    method: null,
    error: lastError
  };
};

const getGitHubAccountList = async () => {
  const result = await tryRunCredentialManagerCommand(['github', 'list']);
  if (result.ok) {
    const accounts = result.result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      supported: true,
      accounts
    };
  }

  if (isUnsupportedGitHubAuthCommandError(result.error)) {
    return {
      supported: false,
      accounts: []
    };
  }

  throw result.error;
};

const getGitHubAuthStatus = async () => {
  try {
    const credentialManagerCommand = await getCredentialManagerCommand();
    const versionResult = await runCredentialManagerCommand(['--version']);
    const accountList = await getGitHubAccountList();

    return {
      available: true,
      command: credentialManagerCommand,
      version: versionResult.stdout || null,
      accounts: accountList.accounts,
      supportsGitHubLoginCommand: accountList.supported
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
  const configuration = await ensureCredentialManagerConfigured();

  const args = ['github', 'login', '--browser', '--url', 'https://github.com'];
  if (force) {
    args.push('--force');
  }

  const loginResult = await tryRunCredentialManagerCommand(args);
  if (loginResult.ok) {
    return loginResult.result;
  }

  if (!isUnsupportedGitHubAuthCommandError(loginResult.error)) {
    throw loginResult.error;
  }

  return {
    stdout: '',
    stderr: '',
    fallback: 'legacy-gcm',
    configured: configuration.configured,
    message: configuration.configured
      ? 'Git Credential Manager on this machine does not support explicit GitHub login. Git will use the configured credential helper during normal pull/push.'
      : 'Git Credential Manager on this machine does not support explicit GitHub login. Pull/push can still use existing system Git credentials.'
  };
};

const logoutFromGitHub = async ({ account }) => {
  if (!account) {
    throw new Error('GitHub account is required');
  }

  return runCredentialManagerCommand(['github', 'logout', account]);
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

const getRemoteChangedFiles = async (git, branch) => {
  const diffOutput = await git.diff(['--name-only', `HEAD..origin/${branch}`]);
  return diffOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const findNamedStashRef = async (git, stashMarker) => {
  const stashListOutput = await git.raw(['stash', 'list', '--format=%gd|%s']);
  const stashLine = stashListOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.includes(stashMarker));

  if (!stashLine) {
    return null;
  }

  return stashLine.split('|')[0] || null;
};

const commitAutomationChanges = async (mainWindow, payload) => {
  const repo = await ensureRepoGlobalEnvironmentSetup(payload.repoPath);
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
  const repo = await ensureRepoGlobalEnvironmentSetup(payload.repoPath);

  if (!repo.remoteUrl || !repo.branch) {
    return {
      skipped: true,
      reason: 'missing-remote-or-branch',
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

  const status = await repo.git.status();
  const localChangedFiles = (status.files || []).map((file) => file.path).filter(Boolean);
  const remoteChangedFiles = await getRemoteChangedFiles(repo.git, repo.branch);
  const overlappingFiles = localChangedFiles.filter((filePath) => remoteChangedFiles.includes(filePath));
  const nonOverlappingLocalFiles = localChangedFiles.filter((filePath) => !overlappingFiles.includes(filePath));

  if (overlappingFiles.length) {
    const trackedOverlapFiles = overlappingFiles.filter((filePath) => {
      const fileStatus = status.files.find((file) => file.path === filePath);
      return fileStatus && fileStatus.index !== '?' && fileStatus.working_dir !== '?';
    });

    if (trackedOverlapFiles.length) {
      await repo.git.raw(['restore', '--source=HEAD', '--staged', '--worktree', '--', ...trackedOverlapFiles]);
    }

    const untrackedOverlapFiles = overlappingFiles.filter((filePath) => {
      const fileStatus = status.files.find((file) => file.path === filePath);
      return fileStatus && (fileStatus.index === '?' || fileStatus.working_dir === '?');
    });

    for (const filePath of untrackedOverlapFiles) {
      const absoluteFilePath = path.join(repo.gitRootPath, filePath);
      if (fs.existsSync(absoluteFilePath)) {
        fs.rmSync(absoluteFilePath, { force: true, recursive: true });
      }
    }
  }

  let stashRef = null;
  if (nonOverlappingLocalFiles.length) {
    const stashMarker = `bruno-git-sync-${Date.now()}`;
    await repo.git.raw(['stash', 'push', '--include-untracked', '-m', stashMarker]);
    stashRef = await findNamedStashRef(repo.git, stashMarker);
  }

  try {
    await pullGitChanges(mainWindow, {
      gitRootPath: repo.gitRootPath,
      processUid: `git-sync-pull-${Date.now()}`,
      remote: 'origin',
      remoteBranch: repo.branch,
      strategy: '--ff-only'
    });
  } catch (error) {
    if (stashRef) {
      try {
        await repo.git.raw(['stash', 'pop', stashRef]);
      } catch (restoreError) {}
    }
    throw error;
  }

  if (stashRef) {
    await repo.git.raw(['stash', 'pop', stashRef]);
  }

  return {
    pulled: true,
    aheadCount,
    behindCount,
    discardedLocalFiles: overlappingFiles,
    restoredLocalFiles: nonOverlappingLocalFiles,
    gitRootPath: repo.gitRootPath,
    branch: repo.branch
  };
};

const getRepoSyncStatus = async (repoPath) => {
  const repo = await ensureRepoGlobalEnvironmentSetup(repoPath);
  const status = await repo.git.status();
  const aheadBehind = await getAheadBehindCount(repo.gitRootPath).catch(() => ({ ahead: 0, behind: 0 }));

  return {
    gitRootPath: repo.gitRootPath,
    branch: repo.branch,
    remoteUrl: repo.remoteUrl,
    authorName: repo.authorName,
    authorEmail: repo.authorEmail,
    repoPrepared: Boolean(repo.repoPrepared),
    trackedEnvironmentFilesRemoved: Number(repo.trackedEnvironmentFilesRemoved || 0),
    ahead: Number(aheadBehind?.ahead || 0),
    behind: Number(aheadBehind?.behind || 0),
    isDirty: Boolean(status.files?.length),
    changedFiles: status.files?.length || 0,
    current: status.current || repo.branch || null,
    tracking: status.tracking || null
  };
};

const pushAutomationChanges = async (mainWindow, payload) => {
  const repo = await ensureRepoGlobalEnvironmentSetup(payload.repoPath);
  const status = await repo.git.status();

  if (!repo.remoteUrl || !repo.branch) {
    return {
      skipped: true,
      reason: 'missing-remote-or-branch',
      gitRootPath: repo.gitRootPath
    };
  }

  let committed = false;
  let message = null;
  if (status.files?.length) {
    await repo.git.add('.');

    const authorName = payload.commitAuthorName || repo.authorName || null;
    const authorEmail = payload.commitAuthorEmail || repo.authorEmail || null;

    if (authorName) {
      await repo.git.addConfig('user.name', authorName, false, 'local');
    }
    if (authorEmail) {
      await repo.git.addConfig('user.email', authorEmail, false, 'local');
    }

    message = buildCommitMessage({
      trigger: 'save',
      workspaceName: payload.workspaceName,
      authorName,
      context: payload.context || {
        targetType: status.files.length > 1 ? 'multiple' : 'manual',
        targetName: null,
        collectionName: null,
        changeCount: status.files.length
      }
    });

    await commitChanges(repo.gitRootPath, message);
    committed = true;
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
    committed,
    message,
    force: Boolean(payload.force),
    gitRootPath: repo.gitRootPath,
    branch: repo.branch,
    remoteUrl: repo.remoteUrl
  };
};

const forcePullAutomationChanges = async (mainWindow, payload) => {
  const repo = await ensureRepoGlobalEnvironmentSetup(payload.repoPath);

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
      const repo = await ensureRepoGlobalEnvironmentSetup(repoPath);
      const githubAuth = await getGitHubAuthStatus();
      return {
        gitRootPath: repo.gitRootPath,
        branch: repo.branch,
        remoteUrl: repo.remoteUrl,
        authorName: repo.authorName,
        authorEmail: repo.authorEmail,
        repoPrepared: Boolean(repo.repoPrepared),
        trackedEnvironmentFilesRemoved: Number(repo.trackedEnvironmentFilesRemoved || 0),
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
