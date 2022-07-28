import 'isomorphic-fetch';

/* eslint-disable no-console */
import { register } from 'fetch-intercept';

jest.setTimeout(50 * 60 * 1000);

if (process.env.DEBUG === 'true') {
  register({
    request(url, config) {
      console.log('[fetch.request]', [url, config]);
      return [url, config];
    },

    requestError(error) {
      console.log('[fetch.requestError]', error);
      return Promise.reject(error);
    },

    response(response) {
      console.log('[fetch.response]', response);
      return response;
    },

    responseError(error) {
      console.log('[fetch.responseError]', error);
      return Promise.reject(error);
    },
  });
}
