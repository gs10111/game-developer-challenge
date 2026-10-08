import axios, { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { getResponse } from 'msw';
import { http } from '../api/matches';
import { handlers } from './handlers';

const FIRST_SERVER_ERROR = 500;

let active = false;

export function servedInPage(): boolean {
  return active;
}

const answerInPage: AxiosAdapter = (config) =>
  new Promise<AxiosResponse>((resolve, reject) => {
    const body = typeof config.data === 'string' ? config.data : null;
    const request = new Request(new URL(axios.getUri(config), window.location.origin), {
      method: (config.method ?? 'get').toUpperCase(),
      body,
      headers: body === null ? {} : { 'Content-Type': 'application/json' },
    });
    let settled = false;
    let timer = 0;
    const fail = (message: string, code: string, response?: AxiosResponse): void => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        reject(new AxiosError(message, code, config, request, response));
      }
    };
    if (config.timeout !== undefined && config.timeout > 0) {
      timer = window.setTimeout(() => {
        fail(`timeout of ${String(config.timeout)}ms exceeded`, AxiosError.ECONNABORTED);
      }, config.timeout);
    }
    config.signal?.addEventListener?.('abort', () => {
      fail('canceled', AxiosError.ERR_CANCELED);
    });
    getResponse(handlers, request)
      .then(async (answer) => {
        if (answer === undefined || answer.type === 'error') {
          fail('Network Error', AxiosError.ERR_NETWORK);
          return;
        }
        const text = await answer.text();
        const response: AxiosResponse = {
          data: text === '' ? null : (JSON.parse(text) as unknown),
          status: answer.status,
          statusText: answer.statusText,
          headers: new AxiosHeaders(),
          config,
          request,
        };
        if (answer.ok) {
          settled = true;
          window.clearTimeout(timer);
          resolve(response);
          return;
        }
        fail(
          `Request failed with status code ${String(answer.status)}`,
          answer.status >= FIRST_SERVER_ERROR
            ? AxiosError.ERR_BAD_RESPONSE
            : AxiosError.ERR_BAD_REQUEST,
          response,
        );
      })
      .catch(() => {
        fail('Network Error', AxiosError.ERR_NETWORK);
      });
  });

export function serveInPage(): void {
  http.defaults.adapter = answerInPage;
  active = true;
}
