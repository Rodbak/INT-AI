import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import NeuralBackground from './NeuralBackground';
import './RouteError.css';

/**
 * Themed error boundary for the router. Without an errorElement, React Router
 * falls back to its own unstyled (white) "Unexpected Application Error" screen —
 * which is what a crash in any page looked like. This keeps the app on-brand and
 * gives the user a way back instead of a blank white page.
 */
export default function RouteError() {
  const error = useRouteError();

  let message = 'Something went wrong while rendering this view.';
  if (isRouteErrorResponse(error)) {
    message = `${error.status} — ${error.statusText || 'Route error'}`;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="route-error">
      <NeuralBackground />
      <div className="route-error__card">
        <div className="route-error__badge" aria-hidden="true">!</div>
        <h1 className="route-error__title">The nervous system hit a snag</h1>
        <p className="route-error__message">{message}</p>
        <div className="route-error__actions">
          <button
            type="button"
            className="route-error__btn route-error__btn--primary"
            onClick={() => window.location.assign('/current-task')}
          >
            Back to Current Task
          </button>
          <button
            type="button"
            className="route-error__btn"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
