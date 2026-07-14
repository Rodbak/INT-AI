import RouteTrace from './RouteTrace';
import ResultCard from './ResultCard';
import type { RouteStep } from '../../data/workspace';
import './AssistantMessage.css';

interface AssistantMessageProps {
  routeSteps: RouteStep[];
  specialistCount: number;
  seconds: number;
  resultBefore: string;
  resultBrand: string;
  resultAfter: string;
  deliverables: string[];
}

export default function AssistantMessage({
  routeSteps,
  specialistCount,
  seconds,
  resultBefore,
  resultBrand,
  resultAfter,
  deliverables,
}: AssistantMessageProps) {
  return (
    <div className="assistant-message">
      <div className="assistant-message__avatar" />
      <div className="assistant-message__content">
        <RouteTrace steps={routeSteps} specialistCount={specialistCount} seconds={seconds} />
        <ResultCard
          before={resultBefore}
          brand={resultBrand}
          after={resultAfter}
          deliverables={deliverables}
        />
      </div>
    </div>
  );
}
