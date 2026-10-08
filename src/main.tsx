import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

function inPageRequested(): boolean {
  return new URLSearchParams(window.location.search).get('mock') === 'in-page';
}

async function startWorker(): Promise<void> {
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}

async function workerAnswers(): Promise<boolean> {
  try {
    const response = await fetch('/api/health');
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && 'status' in body && body.status === 'ok';
  } catch {
    return false;
  }
}

async function enableMocking(): Promise<void> {
  const { selectScenarioFromUrl } = await import('./mocks/scenarios');
  selectScenarioFromUrl();
  if (!inPageRequested()) {
    try {
      await startWorker();
    } catch (error: unknown) {
      console.warn('The mock service worker did not start; answering in the page instead', error);
    }
    if (await workerAnswers()) {
      return;
    }
  }
  const { serveInPage } = await import('./mocks/inPage');
  serveInPage();
}

function renderApp(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('index.html has no #root element');
  }
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void enableMocking()
  .catch((error: unknown) => {
    console.error('The mock API failed to start', error);
  })
  .then(renderApp);
