import { useState } from 'react';
import type { RouteStep } from '../../data/workspace';
import './RouteTrace.css';

interface RouteTraceProps {
  steps: RouteStep[];
  specialistCount: number;
  seconds: number;
}

export default function RouteTrace({ steps, specialistCount, seconds }: RouteTraceProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        className="route-trace__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="route-trace__toggle-dot" />
        <span className="route-trace__toggle-label">
          Routed across {specialistCount} specialists · {seconds}s
        </span>
        <span className={`route-trace__chevron${expanded ? ' route-trace__chevron--open' : ''}`}>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="route-trace__steps">
          {steps.map((step) => (
            <div key={step.role}>
              <div className="route-trace__step-header">
                <span
                  className={`route-trace__step-dot${
                    step.status === 'in-progress' ? ' route-trace__step-dot--pending' : ''
                  }`}
                />
                <span className="route-trace__step-model">{step.model}</span>
                <span className="route-trace__step-sep">·</span>
                <span className="route-trace__step-role">{step.role}</span>
              </div>
              <div className="route-trace__step-trace">
                <span className="route-trace__step-task">{step.task}</span> — {step.trace}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
