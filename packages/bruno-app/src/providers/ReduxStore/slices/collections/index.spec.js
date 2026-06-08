import reducer, { saveCollectionDraft, saveFolderDraft, saveRequest } from './index';

describe('collections slice', () => {
  it('persists draft examples when saving a request', () => {
    const initialState = {
      collections: [
        {
          uid: 'collectionuid00000001',
          items: [
            {
              uid: 'requestuid0000000001',
              type: 'http-request',
              name: 'Test Request',
              seq: 1,
              tags: ['old-tag'],
              settings: { encodeUrl: true },
              request: {
                method: 'GET',
                url: 'https://example.com',
                headers: [],
                params: [],
                body: { mode: 'none' }
              },
              examples: [
                {
                  uid: 'exampleuid0000000001',
                  itemUid: 'requestuid0000000001',
                  name: 'Old Example',
                  description: '',
                  type: 'http-request',
                  request: {
                    method: 'GET',
                    url: 'https://example.com',
                    headers: [],
                    params: [],
                    body: { mode: 'none' }
                  },
                  response: {
                    status: 200,
                    statusText: 'OK',
                    headers: [],
                    body: { type: 'text', content: 'old' }
                  }
                }
              ],
              draft: {
                type: 'http-request',
                name: 'Updated Request',
                seq: 2,
                tags: ['new-tag'],
                settings: { encodeUrl: false },
                request: {
                  method: 'GET',
                  url: 'https://example.com/updated',
                  headers: [],
                  params: [],
                  body: { mode: 'none' }
                },
                examples: [
                  {
                    uid: 'exampleuid0000000001',
                    itemUid: 'requestuid0000000001',
                    name: 'Updated Example',
                    description: '',
                    type: 'http-request',
                    request: {
                      method: 'GET',
                      url: 'https://example.com/updated',
                      headers: [],
                      params: [],
                      body: { mode: 'none' }
                    },
                    response: {
                      status: 200,
                      statusText: 'OK',
                      headers: [],
                      body: { type: 'text', content: 'new' }
                    }
                  }
                ]
              }
            }
          ]
        }
      ],
      collectionSortOrder: 'default',
      activeConnections: [],
      tempDirectories: {},
      saveTransientRequestModals: []
    };

    const nextState = reducer(initialState, saveRequest({
      itemUid: 'requestuid0000000001',
      collectionUid: 'collectionuid00000001'
    }));

    const savedItem = nextState.collections[0].items[0];

    expect(savedItem.name).toBe('Updated Request');
    expect(savedItem.seq).toBe(2);
    expect(savedItem.tags).toEqual(['new-tag']);
    expect(savedItem.settings).toEqual({ encodeUrl: false });
    expect(savedItem.request.url).toBe('https://example.com/updated');
    expect(savedItem.examples).toHaveLength(1);
    expect(savedItem.examples[0].name).toBe('Updated Example');
    expect(savedItem.examples[0].response.body.content).toBe('new');
    expect(savedItem.draft).toBeNull();
  });

  it('persists collection draft root and bruno config when saving collection settings', () => {
    const initialState = {
      collections: [
        {
          uid: 'collectionuid00000001',
          root: {
            request: {
              headers: [{ uid: 'headeruid00000000001', name: 'X-Old', value: '1', enabled: true }]
            }
          },
          brunoConfig: {
            version: '1',
            theme: 'old'
          },
          draft: {
            root: {
              request: {
                headers: [{ uid: 'headeruid00000000002', name: 'X-New', value: '2', enabled: true }]
              }
            },
            brunoConfig: {
              version: '1',
              theme: 'new'
            }
          },
          items: []
        }
      ],
      collectionSortOrder: 'default',
      activeConnections: [],
      tempDirectories: {},
      saveTransientRequestModals: []
    };

    const nextState = reducer(initialState, saveCollectionDraft({
      collectionUid: 'collectionuid00000001'
    }));

    const savedCollection = nextState.collections[0];

    expect(savedCollection.root.request.headers[0].name).toBe('X-New');
    expect(savedCollection.brunoConfig.theme).toBe('new');
    expect(savedCollection.draft).toBeNull();
  });

  it('persists folder draft root when saving folder settings', () => {
    const initialState = {
      collections: [
        {
          uid: 'collectionuid00000001',
          items: [
            {
              uid: 'folderuid00000000001',
              type: 'folder',
              name: 'Folder',
              root: {
                request: {
                  headers: [{ uid: 'headeruid00000000001', name: 'X-Old', value: '1', enabled: true }]
                }
              },
              draft: {
                request: {
                  headers: [{ uid: 'headeruid00000000002', name: 'X-New', value: '2', enabled: true }]
                }
              },
              items: []
            }
          ]
        }
      ],
      collectionSortOrder: 'default',
      activeConnections: [],
      tempDirectories: {},
      saveTransientRequestModals: []
    };

    const nextState = reducer(initialState, saveFolderDraft({
      collectionUid: 'collectionuid00000001',
      folderUid: 'folderuid00000000001'
    }));

    const savedFolder = nextState.collections[0].items[0];

    expect(savedFolder.root.request.headers[0].name).toBe('X-New');
    expect(savedFolder.draft).toBeNull();
  });
});
