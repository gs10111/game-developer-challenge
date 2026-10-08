import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

async function enableMocking(): Promise<void> {
  const { worker } = await import('./mocks/browser');
  const { selectScenarioFromUrl } = await import('./mocks/scenarios');
  selectScenarioFromUrl();
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
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
