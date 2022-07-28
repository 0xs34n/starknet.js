export default (typeof window !== 'undefined' && window.fetch) || // use buildin fetch in browser if available
  (typeof global !== 'undefined' && global.fetch) || // use buildin fetch in node, react-native and service worker if available
  // eslint-disable-next-line global-require
  require('isomorphic-fetch'); // ponyfill fetch in node and browsers that don't have it
