import { delay, http, HttpResponse } from 'msw';
import { matchRecordSchema, PAGE_SIZE } from '../api/contracts';
import { historyOf, rankingFor, saveRecord } from './db';
import { currentScenario } from './scenarios';

const BASE_LATENCY_MS = 150;
const SLOW_LATENCY_MS = 2500;
const JITTER_LATENCIES_MS = [1200, 80, 700, 40];

type Operation = 'read' | 'write';

let requestCount = 0;
const answeredSaves = new Set<string>();

function failure(status: number, message: string): Response {
  return HttpResponse.json({ message }, { status });
}

async function gate(operation: Operation): Promise<Response | null> {
  const scenario = currentScenario();
  requestCount += 1;
  if (scenario === 'network-error') {
    return HttpResponse.error();
  }
  if (scenario === 'timeout') {
    await delay('infinite');
    return null;
  }
  if (scenario === 'slow') {
    await delay(SLOW_LATENCY_MS);
    return null;
  }
  if (scenario === 'jitter') {
    await delay(JITTER_LATENCIES_MS[requestCount % JITTER_LATENCIES_MS.length] ?? BASE_LATENCY_MS);
    return null;
  }
  await delay(BASE_LATENCY_MS);
  if (scenario === 'server-error') {
    return failure(500, 'The server failed.');
  }
  if (scenario === 'client-error') {
    return failure(400, 'The request was rejected.');
  }
  if (scenario === 'reads-fail' && operation === 'read') {
    return failure(503, 'Ranking and history are unavailable.');
  }
  if (scenario === 'save-unavailable' && operation === 'write') {
    return failure(503, 'Saving matches is unavailable.');
  }
  return null;
}

function pageOf<Item>(items: Item[], url: URL) {
  const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || PAGE_SIZE);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const listed = currentScenario() === 'empty' ? [] : items;
  return {
    items: listed.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: listed.length,
  };
}

export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok' })),

  http.get('/api/ranking', async ({ request }) => {
    const blocked = await gate('read');
    if (blocked !== null) {
      return blocked;
    }
    const url = new URL(request.url);
    const config = {
      sessionSeconds: Number(url.searchParams.get('sessionSeconds')),
      spawnSeconds: Number(url.searchParams.get('spawnSeconds')),
    };
    return HttpResponse.json(pageOf(rankingFor(config), url));
  }),

  http.get('/api/players/:playerId/matches', async ({ request, params }) => {
    const blocked = await gate('read');
    if (blocked !== null) {
      return blocked;
    }
    return HttpResponse.json(pageOf(historyOf(String(params.playerId)), new URL(request.url)));
  }),

  http.put('/api/matches/:matchId', async ({ request, params }) => {
    const blocked = await gate('write');
    if (blocked !== null) {
      return blocked;
    }
    const body = matchRecordSchema.safeParse(await request.json());
    if (!body.success || body.data.matchId !== params.matchId) {
      return failure(422, 'The match record is not valid.');
    }
    const { record, created } = saveRecord(body.data);
    if (currentScenario() === 'timeout-after-save' && !answeredSaves.has(record.matchId)) {
      answeredSaves.add(record.matchId);
      await delay('infinite');
    }
    return HttpResponse.json(record, { status: created ? 201 : 200 });
  }),
];
