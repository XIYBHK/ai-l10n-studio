import { lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TranslationWorkspaceSkeleton } from './components/skeletons';

const AppShell = lazy(() => import('./AppShell'));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<TranslationWorkspaceSkeleton />}>
        <AppShell />
      </Suspense>
    </ErrorBoundary>
  );
}
