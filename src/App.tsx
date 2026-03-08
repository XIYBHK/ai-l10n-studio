import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TranslationWorkspaceSkeleton } from './components/skeletons';

const AppShell = lazy(() => import('./AppShell'));

interface AppProps {
  initError?: string | null;
}

export default function App({ initError = null }: AppProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<TranslationWorkspaceSkeleton />}>
        <AppShell initError={initError} />
      </Suspense>
    </ErrorBoundary>
  );
}
