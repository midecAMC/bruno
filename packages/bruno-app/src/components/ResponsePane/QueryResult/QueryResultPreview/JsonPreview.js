import React from 'react';
import ReactJson from 'react-json-view';
import ErrorBanner from 'ui/ErrorBanner';
import { isExpandableJson } from 'utils/response';

const JsonPreview = ({ data, displayedTheme }) => {
  // Helper function to validate and parse JSON data
  const validateJsonData = (data) => {
    if (!isExpandableJson(data)) {
      if (typeof data === 'string') {
        try {
          JSON.parse(data);
          return { data: null, error: 'Data cannot be rendered as a JSON tree. Expected a JSON object or array.' };
        } catch (e) {
          return { data: null, error: `Invalid JSON format: ${e.message}` };
        }
      }

      return { data: null, error: 'Invalid input. Expected a JSON object, array, or valid JSON string.' };
    }

    return { data: typeof data === 'string' ? JSON.parse(data) : data, error: null };
  };

  // Validate and parse JSON data
  const jsonData = validateJsonData(data);

  // Show error if parsing failed
  if (jsonData.error) {
    return <ErrorBanner errors={[{ title: 'Cannot preview as JSON', message: jsonData.error }]} />;
  }

  // Validate that data can be rendered as JSON tree
  if (jsonData.data === null || jsonData.data === undefined) {
    return <ErrorBanner errors={[{ title: 'Cannot preview as JSON', message: 'Data is null or undefined. Expected a valid JSON object or array.' }]} />;
  }

  if (typeof jsonData.data !== 'object') {
    return <ErrorBanner errors={[{ title: 'Cannot preview as JSON', message: 'Data cannot be rendered as a JSON tree. Expected a JSON object or array.' }]} />;
  }

  return (
    <ReactJson
      src={jsonData.data}
      theme={displayedTheme === 'light' ? 'rjv-default' : 'monokai'}
      collapsed={false}
      displayDataTypes={false}
      displayObjectSize={true}
      enableClipboard={true}
      name={false}
      style={{
        backgroundColor: 'transparent',
        fontSize: '12px',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        padding: '16px'
      }}
    />
  );
};

export default JsonPreview;
