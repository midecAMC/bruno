import find from 'lodash/find';
import {
  updateRequestPaneTabHeight,
  updateRequestPaneTabWidth,
  collapseRequestPane,
  collapseResponsePane,
  expandRequestPane,
  expandResponsePane
} from 'providers/ReduxStore/slices/tabs';
import { useDispatch, useSelector } from 'react-redux';

const MIN_TOP_PANE_HEIGHT = 380;

export function useTabPaneBoundaries(activeTabUid) {
  const DEFAULT_PANE_WIDTH_DIVISOR = 2.2;

  const tabs = useSelector((state) => state.tabs.tabs);
  const focusedTab = find(tabs, (t) => t.uid === activeTabUid);
  const screenWidth = useSelector((state) => state.app.screenWidth);
  const preferences = useSelector((state) => state.app.preferences);
  let asideWidth = useSelector((state) => state.app.leftSidebarWidth);
  const persistedLeft = preferences?.layout?.requestPaneWidth;
  const persistedTop = preferences?.layout?.requestPaneHeight;
  const defaultLeft = (screenWidth - asideWidth) / DEFAULT_PANE_WIDTH_DIVISOR;
  const left = focusedTab?.requestPaneWidth || persistedLeft || defaultLeft;
  const top = focusedTab?.requestPaneHeight || persistedTop || MIN_TOP_PANE_HEIGHT;
  const requestPaneCollapsed = focusedTab?.requestPaneCollapsed || false;
  const responsePaneCollapsed = focusedTab?.responsePaneCollapsed || false;
  const dispatch = useDispatch();

  return {
    left,
    top,
    requestPaneCollapsed,
    responsePaneCollapsed,
    setLeft(value) {
      dispatch(updateRequestPaneTabWidth({
        uid: activeTabUid,
        requestPaneWidth: value
      }));
    },
    setTop(value) {
      dispatch(updateRequestPaneTabHeight({
        uid: activeTabUid,
        requestPaneHeight: value
      }));
    },
    collapseRequest() {
      dispatch(collapseRequestPane({ uid: activeTabUid }));
    },
    expandRequest() {
      dispatch(expandRequestPane({ uid: activeTabUid }));
    },
    collapseResponse() {
      dispatch(collapseResponsePane({ uid: activeTabUid }));
    },
    expandResponse() {
      dispatch(expandResponsePane({ uid: activeTabUid }));
    },
    reset() {
      dispatch(expandRequestPane({ uid: activeTabUid }));
      dispatch(expandResponsePane({ uid: activeTabUid }));
      dispatch(updateRequestPaneTabHeight({
        uid: activeTabUid,
        requestPaneHeight: MIN_TOP_PANE_HEIGHT
      }));
      dispatch(updateRequestPaneTabWidth({
        uid: activeTabUid,
        requestPaneWidth: defaultLeft
      }));
    }
  };
}
