import React, { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { updateResponseExampleRequest, updateResponseExampleRequestUrl } from 'providers/ReduxStore/slices/collections';
import HttpMethodSelector from 'components/RequestPane/QueryUrl/HttpMethodSelector';
import SingleLineEditor from 'components/SingleLineEditor';
import StyledWrapper from './StyledWrapper';
import get from 'lodash/get';

const ResponseExampleUrlBar = ({ item, collection, editMode, onSave, exampleUid }) => {
  const dispatch = useDispatch();

  const exampleData = useMemo(() => {
    return item.draft ? get(item, 'draft.examples', []).find((e) => e.uid === exampleUid) : get(item, 'examples', []).find((e) => e.uid === exampleUid);
  }, [item, exampleUid]);
  const method = get(exampleData, 'request.method');
  const url = get(exampleData, 'request.url');

  const onChange = (value) => {
    if (!editMode) {
      return;
    }

    dispatch(updateResponseExampleRequestUrl({
      itemUid: item.uid,
      collectionUid: collection.uid,
      exampleUid: exampleUid,
      request: { url: value }
    }));
  };

  const onMethodSelect = (value) => {
    dispatch(updateResponseExampleRequest({
      itemUid: item.uid,
      collectionUid: collection.uid,
      exampleUid,
      request: { method: value }
    }));
  };

  return (
    <StyledWrapper className="flex items-center w-full mb-3">
      <div className="url-bar-container w-full flex items-center" data-testid="url-bar-container">
        <div className="flex items-center h-full min-w-fit">
          <HttpMethodSelector
            method={method || 'GET'}
            onMethodSelect={onMethodSelect}
          />
        </div>

        <div
          id="response-example-url"
          className="response-example-url flex items-center flex-1 h-full min-w-0 overflow-hidden"
        >
          <SingleLineEditor
            value={url}
            onSave={onSave}
            onChange={onChange}
            collection={collection}
            highlightPathParams={true}
            item={item}
            readOnly={!editMode}
          />
        </div>
      </div>
    </StyledWrapper>
  );
};

export default ResponseExampleUrlBar;
