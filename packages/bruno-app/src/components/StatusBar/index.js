import React, { useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import find from 'lodash/find';
import { IconSettings, IconCookie, IconTool, IconSearch, IconPalette, IconBrandGithub, IconGitBranch, IconArrowBigUpLines, IconArrowBigDownLines, IconRefresh, IconAlertTriangle, IconPoint } from '@tabler/icons';
import Mousetrap from 'mousetrap';
import toast from 'react-hot-toast';
import { getKeyBindingsForActionAllOS } from 'providers/Hotkeys/keyMappings';
import ToolHint from 'components/ToolHint';
import Cookies from 'components/Cookies';
import Notifications from 'components/Notifications';
import Portal from 'components/Portal';
import MenuDropdown from 'ui/MenuDropdown';
import ThemeDropdown from './ThemeDropdown';
import { openConsole } from 'providers/ReduxStore/slices/logs';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { refreshGitSyncStatus, runGitAutomationPull, runGitAutomationPush, runGitAutomationSync } from 'providers/ReduxStore/slices/app';
import { useApp } from 'providers/App';
import StyledWrapper from './StyledWrapper';

const StatusBar = () => {
  const dispatch = useDispatch();
  const activeWorkspaceUid = useSelector((state) => state.workspaces.activeWorkspaceUid);
  const workspaces = useSelector((state) => state.workspaces.workspaces);
  const showHomePage = useSelector((state) => state.app.showHomePage);
  const showManageWorkspacePage = useSelector((state) => state.app.showManageWorkspacePage);
  const showApiSpecPage = useSelector((state) => state.app.showApiSpecPage);
  const tabs = useSelector((state) => state.tabs.tabs);
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const activeTab = find(tabs, (t) => t.uid === activeTabUid);
  const logs = useSelector((state) => state.logs.logs);
  const gitSyncPreferences = useSelector((state) => state.app.preferences?.gitSync);
  const gitSyncStatus = useSelector((state) => state.app.gitSyncStatus);
  const [cookiesOpen, setCookiesOpen] = useState(false);
  const gitMenuRef = useRef(null);
  const { version } = useApp();

  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);

  const errorCount = logs.filter((log) => log.type === 'error').length;
  const syncState = gitSyncStatus.syncState || {};
  const gitSyncEnabled = Boolean(gitSyncPreferences?.enabled && gitSyncPreferences?.repoPath);
  const isGitBusy = Boolean(gitSyncStatus.activeOperation);

  const gitBadge = useMemo(() => {
    if (!gitSyncEnabled) {
      return {
        label: 'Git Off',
        className: 'git-status-disabled',
        icon: IconPoint,
        hint: 'Git sync is disabled'
      };
    }

    if (gitSyncStatus.lastRunError) {
      return {
        label: 'Git Error',
        className: 'git-status-error',
        icon: IconAlertTriangle,
        hint: gitSyncStatus.lastRunError
      };
    }

    if (syncState.isDirty) {
      return {
        label: `Dirty${syncState.changedFiles ? ` ${syncState.changedFiles}` : ''}`,
        className: 'git-status-dirty',
        icon: IconPoint,
        hint: 'Local uncommitted changes'
      };
    }

    if (Number(syncState.behind || 0) > 0) {
      return {
        label: `Behind ${syncState.behind}`,
        className: 'git-status-behind',
        icon: IconArrowBigDownLines,
        hint: 'Remote has new commits'
      };
    }

    if (Number(syncState.ahead || 0) > 0) {
      return {
        label: `Ahead ${syncState.ahead}`,
        className: 'git-status-ahead',
        icon: IconArrowBigUpLines,
        hint: 'Local commits not pushed'
      };
    }

    return {
      label: 'Git Synced',
      className: 'git-status-synced',
      icon: IconGitBranch,
      hint: 'Repository is in sync'
    };
  }, [gitSyncEnabled, gitSyncStatus.lastRunError, syncState]);
  const GitBadgeIcon = gitBadge.icon;

  const handleConsoleClick = () => {
    dispatch(openConsole());
  };

  const handlePreferencesClick = () => {
    const collectionUid = activeTab?.collectionUid || activeWorkspace?.scratchCollectionUid;

    dispatch(
      addTab({
        type: 'preferences',
        uid: collectionUid ? `${collectionUid}-preferences` : 'preferences',
        collectionUid: collectionUid
      })
    );
  };

  const openGlobalSearch = () => {
    const bindings = getKeyBindingsForActionAllOS('globalSearch') || [];
    bindings.forEach((binding) => {
      Mousetrap.trigger(binding);
    });
  };

  const handleRefreshGitStatus = () => {
    dispatch(refreshGitSyncStatus({ silent: false }))
      .then(() => toast.success('Git status refreshed'))
      .catch(() => {});
  };

  const handlePull = (force = false) => {
    dispatch(runGitAutomationPull({ silent: false, reason: 'manual', force }))
      .then((result) => {
        if (result?.pulled) {
          if (result?.discardedLocalFiles?.length) {
            toast.success(`Pulled changes. Replaced ${result.discardedLocalFiles.length} local file(s) with remote versions.`);
          } else if (result?.restoredLocalFiles?.length) {
            toast.success(`Pulled changes and restored ${result.restoredLocalFiles.length} local file(s).`);
          } else {
            toast.success(force ? 'Force pull completed' : 'Changes pulled');
          }
        } else if (result?.skipped) {
          toast(result.reason || 'Nothing to pull');
        } else {
          toast('Repository already up to date');
        }
      })
      .catch(() => {});
  };

  const handlePush = (force = false) => {
    dispatch(runGitAutomationPush({ silent: false, force }))
      .then((result) => {
        if (result?.pushed) {
          if (result?.committed) {
            toast.success(`${force ? 'Force push completed' : 'Changes pushed'} with a new commit.`);
          } else {
            toast.success(force ? 'Force push completed' : 'Changes pushed');
          }
        } else {
          toast(result?.reason || 'Nothing to push');
        }
      })
      .catch(() => {});
  };

  const handleGitQuickSync = (event) => {
    event?.preventDefault?.();

    dispatch(runGitAutomationSync({ silent: false }))
      .then((result) => {
        if (result?.skipped) {
          toast(result.reason || 'Git sync is disabled');
          return;
        }

        if (result?.pulled && result?.pushed) {
          toast.success('Git synchronized. Pulled and pushed changes.');
          return;
        }

        if (result?.pulled) {
          toast.success('Git synchronized. Pulled changes.');
          return;
        }

        if (result?.pushed) {
          toast.success('Git synchronized. Pushed changes.');
          return;
        }

        toast.success('Git status refreshed. Repository already in sync.');
      })
      .catch(() => {});
  };

  const handleGitContextMenu = (event) => {
    event.preventDefault();
    gitMenuRef.current?.show?.();
  };

  const gitMenuItems = [
    {
      id: 'git-refresh',
      label: 'Refresh status',
      leftSection: IconRefresh,
      onClick: handleRefreshGitStatus,
      disabled: !gitSyncEnabled
    },
    {
      id: 'git-pull',
      label: 'Pull changes',
      leftSection: IconArrowBigDownLines,
      onClick: () => handlePull(false),
      disabled: !gitSyncEnabled
    },
    {
      id: 'git-push',
      label: 'Push changes',
      leftSection: IconArrowBigUpLines,
      onClick: () => handlePush(false),
      disabled: !gitSyncEnabled
    },
    { id: 'git-divider', type: 'divider' },
    {
      id: 'git-force-pull',
      label: 'Force pull',
      leftSection: IconArrowBigDownLines,
      onClick: () => handlePull(true),
      disabled: !gitSyncEnabled
    },
    {
      id: 'git-force-push',
      label: 'Force push',
      leftSection: IconArrowBigUpLines,
      onClick: () => handlePush(true),
      disabled: !gitSyncEnabled
    }
  ];

  return (
    <StyledWrapper>
      {cookiesOpen && (
        <Portal>
          <Cookies
            onClose={() => {
              setCookiesOpen(false);
              document.querySelector('[data-trigger="cookies"]').focus();
            }}
            aria-modal="true"
            role="dialog"
            aria-labelledby="cookies-title"
            aria-describedby="cookies-description"
          />
        </Portal>
      )}

      <div className="status-bar">
        <div className="status-bar-section">
          <div className="status-bar-group">
            <ToolHint text="Preferences" toolhintId="Preferences" place="top-start" offset={10}>
              <button
                className="status-bar-button preferences-button"
                data-trigger="preferences"
                onClick={handlePreferencesClick}
                tabIndex={0}
                aria-label="Open Preferences"
              >
                <IconSettings size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </ToolHint>

            <ThemeDropdown>
              <button
                className="status-bar-button"
                data-trigger="theme"
                tabIndex={0}
                aria-label="Change Theme"
              >
                <IconPalette size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </ThemeDropdown>

            <ToolHint text="Notifications" toolhintId="Notifications" place="top" offset={10}>
              <div className="status-bar-button">
                <Notifications />
              </div>
            </ToolHint>

            <ToolHint text="GitHub Repository" toolhintId="GitHub" place="top" offset={10}>
              <button
                className="status-bar-button"
                onClick={() => {
                  window?.ipcRenderer?.openExternal('https://github.com/usebruno/bruno');
                }}
                tabIndex={0}
                aria-label="Open GitHub Repository"
              >
                <IconBrandGithub size={16} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </ToolHint>
          </div>
        </div>

        <div className="status-bar-section">
          <div className="flex items-center gap-3">
            <button
              className="status-bar-button"
              data-trigger="search"
              onClick={openGlobalSearch}
              tabIndex={0}
              aria-label="Global Search"
            >
              <div className="console-button-content">
                <IconSearch size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="console-label">Search</span>
              </div>
            </button>

            <button
              className="status-bar-button"
              data-trigger="cookies"
              onClick={() => setCookiesOpen(true)}
              tabIndex={0}
              aria-label="Open Cookies"
            >
              <div className="console-button-content">
                <IconCookie size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="console-label">Cookies</span>
              </div>
            </button>

            <MenuDropdown
              ref={gitMenuRef}
              items={gitMenuItems}
              placement="top-end"
              disableTriggerClick
              header={(
                <div className="git-dropdown-header">
                  <div className="git-dropdown-title">Git Sync</div>
                  <div className="git-dropdown-meta">
                    <div>Branch: {syncState.branch || gitSyncStatus.repoDetails?.branch || '-'}</div>
                    <div>Ahead: {Number(syncState.ahead || 0)} | Behind: {Number(syncState.behind || 0)}</div>
                    <div>Changed files: {Number(syncState.changedFiles || 0)}</div>
                    <div>Status: {isGitBusy ? `${gitBadge.label} (${gitSyncStatus.activeOperation})` : gitBadge.label}</div>
                    {gitSyncStatus.lastRunError ? <div className="git-dropdown-error">{gitSyncStatus.lastRunError}</div> : null}
                  </div>
                </div>
              )}
            >
              <button
                className={`status-bar-button git-status-button ${gitBadge.className} ${isGitBusy ? 'git-status-busy' : ''}`}
                data-trigger="git-sync"
                onClick={handleGitQuickSync}
                onContextMenu={handleGitContextMenu}
                tabIndex={0}
                aria-label="Open Git sync status"
              >
                <div className="console-button-content">
                  <GitBadgeIcon size={14} strokeWidth={1.8} aria-hidden="true" />
                  <span className="console-label">{isGitBusy ? `Git ${gitSyncStatus.activeOperation}...` : gitBadge.label}</span>
                </div>
              </button>
            </MenuDropdown>

            <button
              className={`status-bar-button ${errorCount > 0 ? 'has-errors' : ''}`}
              data-trigger="dev-tools"
              onClick={handleConsoleClick}
              tabIndex={0}
              aria-label={`Open Dev Tools${errorCount > 0 ? ` (${errorCount} errors)` : ''}`}
            >
              <div className="console-button-content">
                <IconTool size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="console-label">Dev Tools</span>
                {errorCount > 0 && (
                  <span className="error-count-inline">{errorCount}</span>
                )}
              </div>
            </button>

            <div className="status-bar-divider"></div>

            <div className="status-bar-version">
              v{version}
            </div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default StatusBar;
