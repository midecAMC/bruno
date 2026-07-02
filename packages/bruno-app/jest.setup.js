jest.mock('nanoid', () => {
  return {
    nanoid: () => {},
    customAlphabet: () => () => 'testuid1234567890123'
  };
});

jest.mock('strip-json-comments', () => {
  return {
    stripJsonComments: (str) => str
  };
});
