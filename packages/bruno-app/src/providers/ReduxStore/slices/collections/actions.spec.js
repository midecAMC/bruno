import { sendResponseExampleRequest } from './actions';
import { sendNetworkRequest } from 'utils/network/index';

jest.mock('utils/network/index', () => ({
  cancelNetworkRequest: jest.fn(),
  connectWS: jest.fn(),
  sendGrpcRequest: jest.fn(),
  sendNetworkRequest: jest.fn(),
  sendWsRequest: jest.fn(),
  sendCollectionOauth2Request: jest.fn()
}));

describe('collection actions', () => {
  beforeEach(() => {
    sendNetworkRequest.mockReset();
    window.promptForVariables = jest.fn().mockResolvedValue({});
  });

  afterEach(() => {
    delete window.promptForVariables;
  });

  it('sends the latest draft response example request instead of a stale item prop', async () => {
    sendNetworkRequest.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'ok'
    });

    const staleItem = {
      uid: 'requestuid0000000001',
      type: 'http-request',
      name: 'Request',
      request: {
        method: 'GET',
        url: 'https://example.com/parent-saved',
        auth: { mode: 'none' },
        headers: [],
        params: [],
        body: { mode: 'none' }
      },
      examples: [
        {
          uid: 'exampleuid0000000001',
          request: {
            method: 'GET',
            url: 'https://example.com/example-saved',
            auth: { mode: 'none' },
            headers: [],
            params: [],
            body: { mode: 'none' }
          }
        }
      ]
    };

    const latestItem = {
      ...staleItem,
      draft: {
        request: staleItem.request,
        examples: [
          {
            uid: 'exampleuid0000000001',
            request: {
              method: 'POST',
              url: 'https://example.com/example-draft',
              auth: { mode: 'none' },
              headers: [{ uid: 'headeruid0000000001', name: 'X-Draft', value: '1', enabled: true }],
              params: [],
              body: { mode: 'json', json: '{"draft":true}' }
            }
          }
        ]
      }
    };

    const collection = {
      uid: 'collectionuid00000001',
      activeEnvironmentUid: null,
      runtimeVariables: {},
      root: { request: { headers: [] } },
      items: [latestItem]
    };

    const state = {
      collections: {
        collections: [collection]
      },
      globalEnvironments: {
        globalEnvironments: [],
        activeGlobalEnvironmentUid: null
      }
    };

    const dispatch = jest.fn();
    const getState = () => state;

    await sendResponseExampleRequest(staleItem, collection.uid, 'exampleuid0000000001')(dispatch, getState);

    expect(sendNetworkRequest).toHaveBeenCalledTimes(1);
    const sentItem = sendNetworkRequest.mock.calls[0][0];
    expect(sentItem.request).toMatchObject({
      method: 'POST',
      url: 'https://example.com/example-draft',
      headers: [{ uid: 'headeruid0000000001', name: 'X-Draft', value: '1', enabled: true }],
      body: { mode: 'json', json: '{"draft":true}' }
    });
    expect(sentItem.draft.request).toMatchObject({
      method: 'POST',
      url: 'https://example.com/example-draft',
      headers: [{ uid: 'headeruid0000000001', name: 'X-Draft', value: '1', enabled: true }],
      body: { mode: 'json', json: '{"draft":true}' }
    });
  });
});
