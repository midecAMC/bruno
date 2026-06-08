import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import get from 'lodash/get';
import { useDispatch } from 'react-redux';
import { updateResponseExampleResponse } from 'providers/ReduxStore/slices/collections';
import QueryResult, {
  useInitialResponseFormat,
  useResponsePreviewFormatOptions
} from 'components/ResponsePane/QueryResult';
import QueryResultTypeSelector from 'components/ResponsePane/QueryResult/QueryResultTypeSelector';
import ResponseHeaders from 'components/ResponsePane/ResponseHeaders';
import ResponseExampleResponseHeaders from './ResponseExampleResponseHeaders';
import ResponseExampleStatusInput from './ResponseExampleStatusInput';
import StyledWrapper from './StyledWrapper';
import HeightBoundContainer from 'ui/HeightBoundContainer';
import ResponsiveTabs from 'ui/ResponsiveTabs';

const ResponseExampleResponsePane = ({ item, collection, editMode, exampleUid, onSave }) => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('response');
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [selectedViewTab, setSelectedViewTab] = useState(null);
  const rightContentRef = useRef(null);

  const exampleData = useMemo(() => {
    return item.draft ? get(item, 'draft.examples', []).find((e) => e.uid === exampleUid) || {} : get(item, 'examples', []).find((e) => e.uid === exampleUid) || {};
  }, [item, exampleUid]);

  const responseHeaders = useMemo(
    () => Object.fromEntries((exampleData?.response?.headers || []).map((header) => [header.name, header.value])),
    [exampleData]
  );
  const responseData = exampleData?.response?.body?.content || '';
  const displayItem = useMemo(() => ({
    ...item,
    response: {
      data: responseData,
      headers: responseHeaders,
      status: exampleData?.response?.status
    }
  }), [exampleData?.response?.status, item, responseData, responseHeaders]);

  const { initialFormat, initialTab } = useInitialResponseFormat(responseData, null, responseHeaders);
  const formatOptions = useResponsePreviewFormatOptions(null, responseHeaders);

  useEffect(() => {
    setSelectedFormat(initialFormat || 'raw');
    setSelectedViewTab(initialTab || 'editor');
  }, [exampleUid, initialFormat, initialTab]);

  const onResponseEdit = useCallback((value) => {
    dispatch(updateResponseExampleResponse({
      itemUid: item.uid,
      collectionUid: collection.uid,
      exampleUid,
      response: {
        body: {
          type: exampleData?.response?.body?.type || 'text',
          content: value
        }
      }
    }));
  }, [collection.uid, dispatch, exampleData?.response?.body?.type, exampleUid, item.uid]);

  const tabs = [
    { key: 'response', label: 'Response' },
    {
      key: 'headers',
      label: 'Headers',
      indicator: exampleData?.response?.headers?.length
        ? <sup className="ml-1 font-medium">{exampleData.response.headers.length}</sup>
        : null
    }
  ];

  const rightContent = (
    <div ref={rightContentRef} className="flex items-center gap-3">
      {activeTab === 'response' && (
        <QueryResultTypeSelector
          formatOptions={formatOptions}
          formatValue={selectedFormat}
          onFormatChange={setSelectedFormat}
          onPreviewTabSelect={setSelectedViewTab}
          selectedTab={selectedViewTab}
          isActiveTab={true}
          onTabSelect={() => setSelectedViewTab('editor')}
        />
      )}
      <ResponseExampleStatusInput
        item={item}
        collection={collection}
        exampleUid={exampleUid}
        status={exampleData?.response?.status}
        statusText={exampleData?.response?.statusText}
      />
    </div>
  );

  return (
    <StyledWrapper className="flex flex-col h-full relative">
      <div className="px-4">
        <ResponsiveTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabSelect={setActiveTab}
          rightContent={rightContent}
          rightContentRef={rightContentRef}
        />
      </div>

      <section className="response-pane-content">
        <HeightBoundContainer>
          {activeTab === 'response' ? (
            <QueryResult
              item={displayItem}
              collection={collection}
              data={responseData}
              headers={responseHeaders}
              selectedFormat={selectedFormat || 'raw'}
              selectedTab={selectedViewTab || 'editor'}
              docKey={`${item.uid}:example:${exampleUid}:response`}
              onEdit={onResponseEdit}
              onSave={onSave}
              readOnly={!editMode || selectedViewTab === 'preview'}
              disableRunEventListener={true}
            />
          ) : editMode ? (
            <ResponseExampleResponseHeaders
              editMode={editMode}
              item={item}
              collection={collection}
              exampleUid={exampleUid}
            />
          ) : (
            <ResponseHeaders headers={responseHeaders} item={displayItem} />
          )}
        </HeightBoundContainer>
      </section>
    </StyledWrapper>
  );
};

export default ResponseExampleResponsePane;
