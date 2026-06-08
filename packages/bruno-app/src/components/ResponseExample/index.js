import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateRequestPaneTabWidth } from 'providers/ReduxStore/slices/tabs';
import { saveRequest, sendResponseExampleRequest } from 'providers/ReduxStore/slices/collections/actions';
import { cancelResponseExampleEdit } from 'providers/ReduxStore/slices/collections';
import { savePreferences } from 'providers/ReduxStore/slices/app';
import ResponseExampleTopBar from './ResponseExampleTopBar';
import ResponseExampleRequestPane from './ResponseExampleRequestPane';
import ResponseExampleResponsePane from './ResponseExampleResponsePane';
import GenerateCodeItem from 'components/Sidebar/Collections/Collection/CollectionItem/GenerateCodeItem';
import toast from 'react-hot-toast';
import StyledWrapper from './StyledWrapper';
import { hasExampleChanges } from 'utils/collections';

const MIN_LEFT_PANE_WIDTH = 300;
const MIN_RIGHT_PANE_WIDTH = 350;
const MIN_TOP_PANE_HEIGHT = 150;
const MIN_BOTTOM_PANE_HEIGHT = 150;

const ResponseExample = ({ item, collection, example }) => {
  const dispatch = useDispatch();
  const preferences = useSelector((state) => state.app.preferences);
  const screenWidth = useSelector((state) => state.app.screenWidth);
  const leftSidebarWidth = useSelector((state) => state.app.leftSidebarWidth);
  const isVerticalLayout = preferences?.layout?.responsePaneOrientation === 'vertical';
  const defaultPaneWidth = (screenWidth - leftSidebarWidth) / 2.2;
  const persistedLeftPaneWidth = preferences?.layout?.responseExamplePaneWidth;
  const persistedTopPaneHeight = preferences?.layout?.responseExamplePaneHeight;

  const [leftPaneWidth, setLeftPaneWidth] = useState(persistedLeftPaneWidth || defaultPaneWidth);
  const [topPaneHeight, setTopPaneHeight] = useState(persistedTopPaneHeight || MIN_TOP_PANE_HEIGHT);
  const [dragging, setDragging] = useState(false);
  const [showGenerateCodeModal, setShowGenerateCodeModal] = useState(false);
  const [sending, setSending] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const mainSectionRef = useRef(null);

  const persistPaneLayout = (nextLayout) => {
    dispatch(savePreferences({
      ...preferences,
      layout: {
        ...preferences?.layout,
        ...nextLayout
      }
    })).catch(() => {});
  };

  const handleMouseMove = (e) => {
    if (dragging && mainSectionRef.current) {
      e.preventDefault();
      const mainRect = mainSectionRef.current.getBoundingClientRect();

      if (isVerticalLayout) {
        const newHeight = e.clientY - mainRect.top - dragOffset.current.y;
        if (newHeight < MIN_TOP_PANE_HEIGHT || newHeight > mainRect.height - MIN_BOTTOM_PANE_HEIGHT) {
          return;
        }
        setTopPaneHeight(newHeight);
      } else {
        const newWidth = e.clientX - mainRect.left - dragOffset.current.x;
        if (newWidth < MIN_LEFT_PANE_WIDTH || newWidth > mainRect.width - MIN_RIGHT_PANE_WIDTH) {
          return;
        }
        setLeftPaneWidth(newWidth);
      }
    }
  };

  const handleMouseUp = (e) => {
    if (dragging && mainSectionRef.current) {
      e.preventDefault();
      setDragging(false);
      if (!isVerticalLayout) {
        const mainRect = mainSectionRef.current.getBoundingClientRect();
        dispatch(updateRequestPaneTabWidth({
          uid: item.uid,
          requestPaneWidth: e.clientX - mainRect.left
        }));
        persistPaneLayout({
          responseExamplePaneWidth: leftPaneWidth
        });
      } else {
        persistPaneLayout({
          responseExamplePaneHeight: topPaneHeight
        });
      }
    }
  };

  const handleDragbarMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);

    if (isVerticalLayout) {
      const dragBar = e.currentTarget;
      const dragBarRect = dragBar.getBoundingClientRect();
      dragOffset.current.y = e.clientY - dragBarRect.top;
    } else {
      const dragBar = e.currentTarget;
      const dragBarRect = dragBar.getBoundingClientRect();
      dragOffset.current.x = e.clientX - dragBarRect.left;
    }
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragging]);

  const hasChanges = hasExampleChanges(item, example?.uid);

  const handleSave = () => {
    if (item && collection && hasChanges) {
      dispatch(saveRequest(item.uid, collection.uid));
    }
  };

  const handleCancel = () => {
    if (item && collection && example?.uid) {
      dispatch(cancelResponseExampleEdit({
        itemUid: item.uid,
        collectionUid: collection.uid,
        exampleUid: example.uid
      }));
    }
  };

  const handleGenerateCode = (exampleData) => {
    setShowGenerateCodeModal(true);
  };

  const handleCloseGenerateCodeModal = () => {
    setShowGenerateCodeModal(false);
  };

  const handleTryExample = () => {
    if (!item || !collection || !example?.uid || sending) {
      return;
    }

    setSending(true);
    dispatch(sendResponseExampleRequest(item, collection.uid, example.uid))
      .then(() => {
        toast.success('Example sent successfully');
      })
      .catch((error) => {
        toast.error(error?.message || 'Failed to send example');
      })
      .finally(() => {
        setSending(false);
      });
  };

  // Update width when screen width or sidebar width changes
  useEffect(() => {
    if (mainSectionRef.current) {
      const mainRect = mainSectionRef.current.getBoundingClientRect();
      if (isVerticalLayout) {
        setTopPaneHeight((currentHeight) => {
          const fallbackHeight = persistedTopPaneHeight || MIN_TOP_PANE_HEIGHT;
          return Math.max(MIN_TOP_PANE_HEIGHT, Math.min(currentHeight || fallbackHeight, mainRect.height - MIN_BOTTOM_PANE_HEIGHT));
        });
      } else {
        const maxWidth = Math.max(MIN_LEFT_PANE_WIDTH, mainRect.width - MIN_RIGHT_PANE_WIDTH);
        setLeftPaneWidth((currentWidth) => {
          const fallbackWidth = persistedLeftPaneWidth || defaultPaneWidth;
          return Math.max(MIN_LEFT_PANE_WIDTH, Math.min(currentWidth || fallbackWidth, maxWidth));
        });
      }
    }
  }, [defaultPaneWidth, isVerticalLayout, persistedLeftPaneWidth, persistedTopPaneHeight, screenWidth, leftSidebarWidth]);

  // Keyboard shortcut support for Ctrl/Cmd+S and Ctrl/Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && item && collection) {
          handleSave();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (item && collection && example?.uid && !sending) {
          handleTryExample();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasChanges, item, collection, example?.uid, sending]);

  return (
    <>
      <StyledWrapper className={`flex flex-col flex-grow relative ${dragging ? 'dragging' : ''} ${isVerticalLayout ? 'vertical-layout' : ''}`}>
        <ResponseExampleTopBar
          item={item}
          collection={collection}
          exampleUid={example.uid}
          hasChanges={hasChanges}
          onSave={handleSave}
          onCancel={handleCancel}
          onGenerateCode={handleGenerateCode}
          onTryExample={handleTryExample}
          sending={sending}
        />
        <section ref={mainSectionRef} className={`main wrapper flex mt-4 ${isVerticalLayout ? 'flex-col' : ''} flex-grow pb-4 relative overflow-auto scrollbar-hover`}>
          <section className="request-pane" data-testid="request-pane">
            <div
              className="px-4 h-full"
              style={isVerticalLayout ? {
                height: `${Math.max(topPaneHeight, MIN_TOP_PANE_HEIGHT)}px`,
                minHeight: `${MIN_TOP_PANE_HEIGHT}px`,
                width: '100%'
              } : {
                width: `${Math.max(leftPaneWidth, MIN_LEFT_PANE_WIDTH)}px`
              }}
            >
              <ResponseExampleRequestPane
                item={item}
                collection={collection}
                example={example}
                editMode={true}
                exampleUid={example?.uid}
                onSave={handleSave}
              />
            </div>
          </section>

          <div className="dragbar-wrapper" onMouseDown={handleDragbarMouseDown}>
            <div className="dragbar-handle" />
          </div>

          <section className="response-pane flex-grow overflow-x-auto" data-testid="response-pane">
            <ResponseExampleResponsePane
              item={item}
              collection={collection}
              example={example}
              editMode={true}
              exampleUid={example?.uid}
              onSave={handleSave}
            />
          </section>
        </section>
      </StyledWrapper>

      {showGenerateCodeModal && (
        <GenerateCodeItem
          collectionUid={collection.uid}
          item={item}
          onClose={handleCloseGenerateCodeModal}
          isExample={true}
          exampleUid={example.uid}
        />
      )}
    </>
  );
};

export default ResponseExample;
