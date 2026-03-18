import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import debounce from 'lodash/debounce';
import get from 'lodash/get';
import { useFormik } from 'formik';
import { useDispatch, useSelector } from 'react-redux';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import StyledWrapper from '../General/StyledWrapper';
import {
  savePreferences,
  getGitAutomationRepoDetails,
  getGitHubAuthStatus,
  loginGitHubForGitSync,
  logoutGitHubForGitSync,
  runGitAutomationPull,
  runGitAutomationTrigger
} from 'providers/ReduxStore/slices/app';
import { browseDirectory } from 'providers/ReduxStore/slices/collections/actions';

const gitSyncSchema = Yup.object().shape({
  enabled: Yup.boolean(),
  repoPath: Yup.string().max(2048),
  autoPull: Yup.boolean(),
  autoPush: Yup.boolean(),
  pullInterval: Yup.mixed()
    .transform((value, originalValue) => originalValue === '' ? undefined : value)
    .test('isNumber', 'Pull interval must be a number', (value) => value === undefined || !isNaN(value))
    .test('isValid', 'Pull interval must be at least 1000ms', (value) => value === undefined || Number(value) >= 1000),
  commitDelay: Yup.mixed()
    .transform((value, originalValue) => originalValue === '' ? undefined : value)
    .test('isNumber', 'Commit delay must be a number', (value) => value === undefined || !isNaN(value))
    .test('isValid', 'Commit delay cannot be negative', (value) => value === undefined || Number(value) >= 0),
  commitAuthorName: Yup.string().max(256),
  commitAuthorEmail: Yup.string().max(256),
  commitTriggers: Yup.object({
    onSave: Yup.boolean(),
    onCreateRequest: Yup.boolean(),
    onClose: Yup.boolean()
  })
});

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return 'never';
  }

  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return timestamp;
  }
};

const GitSync = () => {
  const preferences = useSelector((state) => state.app.preferences);
  const gitSyncStatus = useSelector((state) => state.app.gitSyncStatus);
  const dispatch = useDispatch();
  const [repoInfo, setRepoInfo] = useState(null);
  const [repoError, setRepoError] = useState('');
  const [repoLoading, setRepoLoading] = useState(false);

  const gitSyncPreferences = useMemo(() => ({
    enabled: get(preferences, 'gitSync.enabled', false),
    repoPath: get(preferences, 'gitSync.repoPath', ''),
    autoPull: get(preferences, 'gitSync.autoPull', true),
    autoPush: get(preferences, 'gitSync.autoPush', true),
    pullInterval: get(preferences, 'gitSync.pullInterval', 30000),
    commitDelay: get(preferences, 'gitSync.commitDelay', 1500),
    commitAuthorName: get(preferences, 'gitSync.commitAuthorName', ''),
    commitAuthorEmail: get(preferences, 'gitSync.commitAuthorEmail', ''),
    commitTriggers: {
      onSave: get(preferences, 'gitSync.commitTriggers.onSave', true),
      onCreateRequest: get(preferences, 'gitSync.commitTriggers.onCreateRequest', false),
      onClose: get(preferences, 'gitSync.commitTriggers.onClose', false)
    }
  }), [preferences]);

  const handleSave = useCallback((values) => {
    dispatch(savePreferences({
      ...preferences,
      gitSync: {
        ...values,
        pullInterval: Number(values.pullInterval || 30000),
        commitDelay: Number(values.commitDelay || 0)
      }
    })).catch(() => toast.error('Failed to update Git Sync preferences'));
  }, [dispatch, preferences]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const formik = useFormik({
    initialValues: gitSyncPreferences,
    validationSchema: gitSyncSchema,
    onSubmit: async (values) => {
      const validatedValues = await gitSyncSchema.validate(values, { abortEarly: true });
      handleSave(validatedValues);
    }
  });

  const debouncedSave = useCallback(
    debounce((values) => {
      gitSyncSchema.validate(values, { abortEarly: true })
        .then((validatedValues) => handleSaveRef.current(validatedValues))
        .catch(() => {});
    }, 500),
    []
  );

  useEffect(() => {
    dispatch(getGitHubAuthStatus()).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (formik.dirty && formik.isValid) {
      debouncedSave(formik.values);
    }
    return () => debouncedSave.flush();
  }, [formik.values, formik.dirty, formik.isValid, debouncedSave]);

  const loadRepoInfo = useCallback((repoPath) => {
    if (!repoPath) {
      setRepoInfo(null);
      setRepoError('');
      return Promise.resolve();
    }

    setRepoLoading(true);
    setRepoError('');
    return dispatch(getGitAutomationRepoDetails(repoPath))
      .then((details) => {
        setRepoInfo(details);
        setRepoError('');
        return details;
      })
      .catch((error) => {
        setRepoInfo(null);
        setRepoError(error?.message || 'Could not read repository details');
      })
      .finally(() => setRepoLoading(false));
  }, [dispatch]);

  useEffect(() => {
    loadRepoInfo(formik.values.repoPath);
  }, [formik.values.repoPath, loadRepoInfo]);

  const handleBrowseRepo = () => {
    dispatch(browseDirectory())
      .then((dirPath) => {
        if (typeof dirPath === 'string') {
          formik.setFieldValue('repoPath', dirPath);
        }
      })
      .catch(() => {});
  };

  const handleGitHubLogin = () => {
    dispatch(loginGitHubForGitSync())
      .then(() => {
        toast.success('GitHub login completed');
        if (formik.values.repoPath) {
          loadRepoInfo(formik.values.repoPath);
        }
      })
      .catch((error) => {
        toast.error(error?.message || 'GitHub login failed');
      });
  };

  const handleGitHubLogout = (account) => {
    dispatch(logoutGitHubForGitSync(account))
      .then(() => toast.success(`Disconnected ${account}`))
      .catch((error) => toast.error(error?.message || 'GitHub logout failed'));
  };

  const handlePullNow = () => {
    dispatch(runGitAutomationPull({ silent: false, reason: 'manual' }))
      .then((result) => {
        if (result?.pulled) {
          toast.success('Remote changes pulled');
        } else if (result?.skipped) {
          toast('Nothing to pull');
        } else {
          toast('Repository already up to date');
        }
      })
      .catch(() => {});
  };

  const handleCommitNow = () => {
    dispatch(runGitAutomationTrigger({
      trigger: 'save',
      context: {
        targetType: 'manual',
        targetName: 'manual sync'
      },
      silent: false
    }))
      .then((result) => {
        if (result?.committed) {
          toast.success('Changes committed');
        } else {
          toast('No local changes to commit');
        }
      })
      .catch(() => {});
  };

  return (
    <StyledWrapper className="w-full">
      <form className="bruno-form" onSubmit={formik.handleSubmit}>
        <div className="section-header">Git Automation</div>

        <div className="flex items-center mt-2">
          <input
            id="gitSync.enabled"
            type="checkbox"
            name="enabled"
            checked={formik.values.enabled}
            onChange={formik.handleChange}
            className="mousetrap mr-0"
          />
          <label className="block ml-2 select-none" htmlFor="gitSync.enabled">
            Enable automatic Git sync
          </label>
        </div>

        <div className="flex flex-col mt-6">
          <label className="block select-none" htmlFor="repoPath">Repository</label>
          <p className="text-xs mt-1 opacity-70">
            Bruno will only automate one repository. Pick the root folder of that repo.
          </p>
          <input
            type="text"
            id="repoPath"
            name="repoPath"
            className="block textbox mt-2 w-full cursor-pointer"
            readOnly={true}
            value={formik.values.repoPath || ''}
            onClick={handleBrowseRepo}
            placeholder="Click to choose a Git repository"
          />
          <div className="flex gap-3 mt-2 text-sm">
            <span className="text-link cursor-pointer hover:underline" onClick={handleBrowseRepo}>Browse</span>
            <span className="text-link cursor-pointer hover:underline" onClick={() => loadRepoInfo(formik.values.repoPath)}>Refresh repo info</span>
            <span className="text-link cursor-pointer hover:underline" onClick={handlePullNow}>Pull now</span>
            <span className="text-link cursor-pointer hover:underline" onClick={handleCommitNow}>Commit now</span>
          </div>
        </div>

        <div className="mt-4 text-xs opacity-70">
          GitHub login uses Git Credential Manager and opens your browser for authorization.
        </div>

        <div className="mt-4 text-sm">
          {repoLoading ? <div>Checking repository...</div> : null}
          {!repoLoading && repoInfo ? (
            <>
              <div>Git root: {repoInfo.gitRootPath}</div>
              <div>Branch: {repoInfo.branch || 'unknown'}</div>
              <div>Remote: {repoInfo.remoteUrl || 'origin not configured'}</div>
              <div>Git user: {repoInfo.authorName || 'not configured'}{repoInfo.authorEmail ? ` <${repoInfo.authorEmail}>` : ''}</div>
            </>
          ) : null}
          {!repoLoading && repoError ? (
            <div className="text-red-500">{repoError}</div>
          ) : null}
        </div>

        <div className={`mt-6 ${!formik.values.enabled ? 'opacity-50' : ''}`}>
          <div className="section-title mb-2">GitHub Login</div>
          <div className="text-sm">
            <div>Status: {gitSyncStatus.authAvailable === false ? 'Git Credential Manager not available' : gitSyncStatus.githubAccounts?.length ? 'Connected' : 'Not connected'}</div>
            <div>Provider: {gitSyncStatus.authProviderVersion ? `Git Credential Manager ${gitSyncStatus.authProviderVersion}` : 'unknown'}</div>
            <div className="mt-2 flex gap-3">
              <span className="text-link cursor-pointer hover:underline" onClick={handleGitHubLogin}>
                {gitSyncStatus.authInProgress ? 'Authorizing...' : 'Sign in with GitHub'}
              </span>
              <span className="text-link cursor-pointer hover:underline" onClick={() => dispatch(getGitHubAuthStatus()).catch(() => {})}>
                Refresh auth status
              </span>
            </div>
            {gitSyncStatus.githubAccounts?.length ? (
              <div className="mt-3">
                {gitSyncStatus.githubAccounts.map((account) => (
                  <div key={account} className="flex gap-3">
                    <span>Connected account: {account}</span>
                    <span className="text-link cursor-pointer hover:underline" onClick={() => handleGitHubLogout(account)}>
                      Sign out
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {gitSyncStatus.authError ? (
              <div className="text-red-500 mt-2">{gitSyncStatus.authError}</div>
            ) : null}
          </div>
        </div>

        <div className={`mt-6 ${!formik.values.enabled ? 'opacity-50' : ''}`}>
          <div className="section-title mb-2">Commit Triggers</div>

          <div className="flex items-center mt-2">
            <input
              id="commitTriggers.onSave"
              type="checkbox"
              name="commitTriggers.onSave"
              checked={formik.values.commitTriggers.onSave}
              onChange={formik.handleChange}
              className="mousetrap mr-0"
              disabled={!formik.values.enabled}
            />
            <label className="block ml-2 select-none" htmlFor="commitTriggers.onSave">
              Commit after each save
            </label>
          </div>

          <div className="flex items-center mt-2">
            <input
              id="commitTriggers.onCreateRequest"
              type="checkbox"
              name="commitTriggers.onCreateRequest"
              checked={formik.values.commitTriggers.onCreateRequest}
              onChange={formik.handleChange}
              className="mousetrap mr-0"
              disabled={!formik.values.enabled}
            />
            <label className="block ml-2 select-none" htmlFor="commitTriggers.onCreateRequest">
              Commit after creating request or folder
            </label>
          </div>

          <div className="flex items-center mt-2">
            <input
              id="commitTriggers.onClose"
              type="checkbox"
              name="commitTriggers.onClose"
              checked={formik.values.commitTriggers.onClose}
              onChange={formik.handleChange}
              className="mousetrap mr-0"
              disabled={!formik.values.enabled}
            />
            <label className="block ml-2 select-none" htmlFor="commitTriggers.onClose">
              Commit when closing the app
            </label>
          </div>
        </div>

        <div className={`mt-6 ${!formik.values.enabled ? 'opacity-50' : ''}`}>
          <div className="section-title mb-2">Sync Behaviour</div>

          <div className="flex items-center mt-2">
            <input
              id="autoPush"
              type="checkbox"
              name="autoPush"
              checked={formik.values.autoPush}
              onChange={formik.handleChange}
              className="mousetrap mr-0"
              disabled={!formik.values.enabled}
            />
            <label className="block ml-2 select-none" htmlFor="autoPush">
              Push automatically after commit
            </label>
          </div>

          <div className="flex items-center mt-2">
            <input
              id="autoPull"
              type="checkbox"
              name="autoPull"
              checked={formik.values.autoPull}
              onChange={formik.handleChange}
              className="mousetrap mr-0"
              disabled={!formik.values.enabled}
            />
            <label className="block ml-2 select-none" htmlFor="autoPull">
              Pull remote changes periodically
            </label>
          </div>

          <div className="flex flex-col mt-3">
            <label className="block select-none" htmlFor="pullInterval">Pull interval (ms)</label>
            <input
              type="text"
              id="pullInterval"
              name="pullInterval"
              className="block textbox mt-2 w-32"
              value={formik.values.pullInterval}
              onChange={formik.handleChange}
              disabled={!formik.values.enabled || !formik.values.autoPull}
            />
          </div>

          <div className="flex flex-col mt-3">
            <label className="block select-none" htmlFor="commitDelay">Commit debounce (ms)</label>
            <input
              type="text"
              id="commitDelay"
              name="commitDelay"
              className="block textbox mt-2 w-32"
              value={formik.values.commitDelay}
              onChange={formik.handleChange}
              disabled={!formik.values.enabled}
            />
          </div>

          <div className="flex flex-col mt-3">
            <label className="block select-none" htmlFor="commitAuthorName">Commit author name override</label>
            <input
              type="text"
              id="commitAuthorName"
              name="commitAuthorName"
              className="block textbox mt-2 w-full"
              value={formik.values.commitAuthorName}
              onChange={formik.handleChange}
              disabled={!formik.values.enabled}
              placeholder="Leave empty to use git config user.name"
            />
          </div>

          <div className="flex flex-col mt-3">
            <label className="block select-none" htmlFor="commitAuthorEmail">Commit author email override</label>
            <input
              type="text"
              id="commitAuthorEmail"
              name="commitAuthorEmail"
              className="block textbox mt-2 w-full"
              value={formik.values.commitAuthorEmail}
              onChange={formik.handleChange}
              disabled={!formik.values.enabled}
              placeholder="Leave empty to use git config user.email"
            />
          </div>
        </div>

        <div className={`mt-6 ${!formik.values.enabled ? 'opacity-50' : ''}`}>
          <div className="section-title mb-2">Sync Status</div>
          <div className="text-sm">
            <div>Last commit: {formatTimestamp(gitSyncStatus.lastCommitAt)}</div>
            <div>Commit status: {gitSyncStatus.lastCommitStatus || 'idle'}</div>
            <div>Last commit message: {gitSyncStatus.lastCommitMessage || '-'}</div>
            <div>Last push: {formatTimestamp(gitSyncStatus.lastPushAt)}</div>
            <div>Push status: {gitSyncStatus.lastPushStatus || 'idle'}</div>
            <div>Last pull: {formatTimestamp(gitSyncStatus.lastPullAt)}</div>
            <div>Pull status: {gitSyncStatus.lastPullStatus || 'idle'}</div>
            <div>Last error: {gitSyncStatus.lastRunError || '-'}</div>
          </div>
        </div>

        {formik.errors.pullInterval ? <div className="text-red-500 mt-2">{formik.errors.pullInterval}</div> : null}
        {formik.errors.commitDelay ? <div className="text-red-500 mt-2">{formik.errors.commitDelay}</div> : null}
      </form>
    </StyledWrapper>
  );
};

export default GitSync;
