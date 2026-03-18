import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { refreshGitSyncStatus, runGitAutomationPull } from 'providers/ReduxStore/slices/app';

const useGitSyncPolling = () => {
  const dispatch = useDispatch();
  const gitSyncPreferences = useSelector((state) => state.app.preferences?.gitSync);

  useEffect(() => {
    dispatch(refreshGitSyncStatus({ silent: true })).catch(() => {});
  }, [dispatch, gitSyncPreferences?.enabled, gitSyncPreferences?.repoPath]);

  useEffect(() => {
    if (!gitSyncPreferences?.enabled || !gitSyncPreferences?.repoPath || !gitSyncPreferences?.autoPull) {
      return () => {};
    }

    const pullInterval = Number(gitSyncPreferences.pullInterval || 30000);
    if (pullInterval < 1000) {
      return () => {};
    }

    const timer = window.setInterval(() => {
      dispatch(runGitAutomationPull({ silent: true, reason: 'poll' })).catch(() => {});
    }, pullInterval);

    return () => window.clearInterval(timer);
  }, [dispatch, gitSyncPreferences]);
};

export default useGitSyncPolling;
