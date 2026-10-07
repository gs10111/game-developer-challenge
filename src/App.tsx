import { useEffect, useState } from 'react';

type MockApiStatus = 'checking' | 'ok' | 'unavailable';

function isHealthy(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'status' in body && body.status === 'ok';
}

async function readMockApiStatus(signal: AbortSignal): Promise<MockApiStatus> {
  try {
    const response = await fetch('/api/health', { signal });
    const body: unknown = await response.json();
    return isHealthy(body) ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function App() {
  const [mockApiStatus, setMockApiStatus] = useState<MockApiStatus>('checking');

  useEffect(() => {
    const aborter = new AbortController();
    void readMockApiStatus(aborter.signal).then((status) => {
      if (!aborter.signal.aborted) {
        setMockApiStatus(status);
      }
    });
    return () => {
      aborter.abort();
    };
  }, []);

  return (
    <main>
      <h1>Pirate Battle</h1>
      <p data-testid="mock-api-status">Mock API: {mockApiStatus}</p>
    </main>
  );
}
