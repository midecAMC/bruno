import React, { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { IconCode, IconDeviceFloppy, IconSend } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';
import { useTheme } from 'providers/Theme';
import { updateResponseExampleName } from 'providers/ReduxStore/slices/collections';
import get from 'lodash/get';
import Button from 'ui/Button';

const ResponseExampleTopBar = ({
  item,
  collection,
  exampleUid,
  hasChanges,
  onSave,
  onCancel,
  onGenerateCode,
  onTryExample,
  sending = false
}) => {
  const { theme } = useTheme();
  const dispatch = useDispatch();

  const example = useMemo(() => {
    return item.draft ? get(item, 'draft.examples', []).find((e) => e.uid === exampleUid) : get(item, 'examples', []).find((e) => e.uid === exampleUid);
  }, [item.draft, item.examples, item, exampleUid]);

  const handleGenerateCode = () => {
    if (onGenerateCode) {
      onGenerateCode({
        ...example,
        isExample: true,
        exampleUid: exampleUid
      });
    }
  };

  const handleTryExample = () => {
    if (onTryExample) {
      onTryExample(example);
    }
  };

  const handleNameChange = (e) => {
    // Validate required fields before dispatching
    if (!item?.uid) {
      console.error('item.uid is missing');
      return;
    }
    if (!collection?.uid) {
      console.error('collection.uid is missing');
      return;
    }
    if (!exampleUid) {
      console.error('exampleUid is missing');
      return;
    }

    dispatch(updateResponseExampleName({
      itemUid: item.uid,
      collectionUid: collection.uid,
      exampleUid: exampleUid,
      name: e.target.value
    }));
  };

  const handleSave = () => {
    // Call the parent save handler
    if (onSave) {
      onSave();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  if (!example || !exampleUid) {
    return null;
  }

  return (
    <StyledWrapper className="p-4">
      <div className="max-w-full">
        <div className="flex items-start justify-between gap-6 md:flex-row flex-col">
          <div className="flex-1 min-w-0">
            <div className="response-example-title font-medium leading-tight mb-2">
              <span className="opacity-60">{item.name}</span>
              {' / '}
              <span>Example</span>
            </div>
            <input
              type="text"
              value={example?.name || ''}
              onChange={handleNameChange}
              className="example-input example-input-name"
              placeholder="Enter example name"
              data-testid="response-example-name-input"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 md:w-auto w-full md:justify-end">
            <Button
              color="primary"
              size="sm"
              icon={<IconSend size={16} color={theme.examples.buttonIconColor} />}
              onClick={handleTryExample}
              title="Send Example"
              disabled={sending}
              data-testid="response-example-send-btn"
            >
              {sending ? 'Sending...' : 'Try Example'}
            </Button>
            <Button
              color="secondary"
              size="sm"
              icon={<IconCode size={16} color={theme.examples.buttonIconColor} />}
              onClick={handleGenerateCode}
              title="Generate Code"
              data-testid="response-example-generate-code-btn"
            />
            <Button
              color="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={!hasChanges}
              data-testid="response-example-cancel-btn"
            >
              Discard
            </Button>
            <Button
              color="secondary"
              size="sm"
              icon={<IconDeviceFloppy size={16} color={hasChanges ? theme.draftColor : theme.examples.buttonIconColor} />}
              onClick={handleSave}
              disabled={!hasChanges}
              data-testid="response-example-save-btn"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default ResponseExampleTopBar;
