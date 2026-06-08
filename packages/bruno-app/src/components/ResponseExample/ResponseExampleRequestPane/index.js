import React, { useCallback, useMemo, useRef, useState } from 'react';
import classnames from 'classnames';
import get from 'lodash/get';
import { useDispatch } from 'react-redux';
import { updateResponseExampleRequest } from 'providers/ReduxStore/slices/collections';
import ResponseExampleUrlBar from './ResponseExampleUrlBar';
import ResponseExampleParams from './ResponseExampleParams';
import ResponseExampleHeaders from './ResponseExampleHeaders';
import ResponseExampleBody from './ResponseExampleBody';
import ResponseExampleBodyMode from './ResponseExampleBodyMode';
import StyledWrapper from './StyledWrapper';
import ResponsiveTabs from 'ui/ResponsiveTabs';
import HeightBoundContainer from 'ui/HeightBoundContainer';

const TABS = [
  { key: 'params', label: 'Params' },
  { key: 'body', label: 'Body' },
  { key: 'headers', label: 'Headers' }
];

const ResponseExampleRequestPane = ({ item, collection, editMode, exampleUid, onSave }) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('body');
  const rightContentRef = useRef(null);

  const example = useMemo(() => {
    const examples = item.draft ? get(item, 'draft.examples', []) : get(item, 'examples', []);
    return examples.find((entry) => entry.uid === exampleUid);
  }, [item, exampleUid]);

  const body = example?.request?.body || { mode: 'none' };

  const onBodyEdit = useCallback((value) => {
    const updatedBody = { ...body };

    if (['json', 'text', 'xml', 'sparql'].includes(body.mode)) {
      updatedBody[body.mode] = value;
    }

    dispatch(updateResponseExampleRequest({
      itemUid: item.uid,
      collectionUid: collection.uid,
      exampleUid,
      request: { body: updatedBody }
    }));
  }, [body, collection.uid, dispatch, exampleUid, item.uid]);

  const panels = {
    params: (
      <ResponseExampleParams
        editMode={editMode}
        item={item}
        collection={collection}
        exampleUid={exampleUid}
      />
    ),
    body: (
      <ResponseExampleBody
        editMode={editMode}
        item={item}
        collection={collection}
        exampleUid={exampleUid}
        onSave={onSave}
      />
    ),
    headers: (
      <ResponseExampleHeaders
        editMode={editMode}
        item={item}
        collection={collection}
        exampleUid={exampleUid}
      />
    )
  };

  const rightContent = activeTab === 'body' ? (
    <div ref={rightContentRef}>
      <ResponseExampleBodyMode
        item={item}
        collection={collection}
        exampleUid={exampleUid}
        body={body}
        bodyMode={body.mode}
        onBodyEdit={onBodyEdit}
        editMode={editMode}
      />
    </div>
  ) : null;

  return (
    <HeightBoundContainer>
      <StyledWrapper className="flex flex-col h-full w-full">
        <ResponseExampleUrlBar
          item={item}
          collection={collection}
          exampleUid={exampleUid}
          editMode={editMode}
          onSave={onSave}
        />

        <ResponsiveTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabSelect={setActiveTab}
          rightContent={rightContent}
          rightContentRef={rightContent ? rightContentRef : null}
          delayedTabs={['body']}
        />

        <section className={classnames('flex w-full flex-1 mt-4')}>
          <HeightBoundContainer>{panels[activeTab]}</HeightBoundContainer>
        </section>
      </StyledWrapper>
    </HeightBoundContainer>
  );
};

export default ResponseExampleRequestPane;
