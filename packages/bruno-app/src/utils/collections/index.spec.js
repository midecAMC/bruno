const { describe, it, expect } = require('@jest/globals');
import {
  getEnvironmentVariables,
  getGlobalEnvironmentVariables,
  mergeHeaders,
  transformRequestToSaveToFilesystem
} from './index';

describe('mergeHeaders', () => {
  it('should include headers from collection, folder and request (with correct precedence)', () => {
    const collection = {
      root: {
        request: {
          headers: [
            { name: 'X-Collection', value: 'c', enabled: true }
          ]
        }
      }
    };

    const folder = {
      type: 'folder',
      root: {
        request: {
          headers: [
            { name: 'X-Folder', value: 'f', enabled: true }
          ]
        }
      }
    };

    const request = {
      headers: [
        { name: 'X-Request', value: 'r', enabled: true }
      ]
    };

    const headers = mergeHeaders(collection, request, [folder]);
    const names = headers.map((h) => h.name);
    expect(names).toEqual(expect.arrayContaining(['X-Collection', 'X-Folder', 'X-Request']));
  });
});

describe('transformRequestToSaveToFilesystem', () => {
  it('preserves header and param annotations', () => {
    const item = {
      uid: 'requestuid123456789012',
      type: 'http-request',
      name: 'Annotated Request',
      seq: 1,
      settings: {},
      tags: [],
      examples: [],
      request: {
        method: 'GET',
        url: 'https://example.com',
        params: [
          {
            uid: 'paramuid1234567890123',
            name: 'q',
            value: '1',
            description: '',
            annotations: [{ name: 'param-note', value: 'keep me' }],
            type: 'query',
            enabled: true
          }
        ],
        headers: [
          {
            uid: 'headeruid123456789012',
            name: 'X-Test',
            value: '1',
            description: '',
            annotations: [{ name: 'header-note', value: 'keep me' }],
            enabled: true
          }
        ],
        auth: { mode: 'none' },
        body: { mode: 'none' },
        script: { req: '', res: '' },
        vars: { req: [], res: [] },
        assertions: [],
        tests: '',
        docs: ''
      }
    };

    const transformed = transformRequestToSaveToFilesystem(item);

    expect(transformed.request.params[0].annotations).toEqual([{ name: 'param-note', value: 'keep me' }]);
    expect(transformed.request.headers[0].annotations).toEqual([{ name: 'header-note', value: 'keep me' }]);
  });
});

describe('environment variables', () => {
  it('preserves duplicate environment rows and resolves to the selected enabled value', () => {
    const collection = {
      activeEnvironmentUid: 'env-1',
      environments: [
        {
          uid: 'env-1',
          variables: [
            { uid: 'var-1', name: 'token', value: 'old-token', enabled: false, type: 'text', secret: false },
            { uid: 'var-2', name: 'token', value: 'active-token', enabled: true, type: 'text', secret: false }
          ]
        }
      ]
    };

    expect(collection.environments[0].variables).toHaveLength(2);
    expect(getEnvironmentVariables(collection)).toEqual({ token: 'active-token' });
  });

  it('resolves duplicate global environment rows to the selected enabled value', () => {
    const globalEnvironments = [
      {
        uid: 'global-env-1',
        variables: [
          { uid: 'var-1', name: 'token', value: 'old-token', enabled: false, type: 'text', secret: false },
          { uid: 'var-2', name: 'token', value: 'active-token', enabled: true, type: 'text', secret: false }
        ]
      }
    ];

    expect(getGlobalEnvironmentVariables({ globalEnvironments, activeGlobalEnvironmentUid: 'global-env-1' })).toEqual({
      token: 'active-token'
    });
  });
});
