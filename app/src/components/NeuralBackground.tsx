import NeuralField from './NeuralField';
import './NeuralBackground.css';

// The app-wide living substrate. A single fixed neural field sits behind every
// page; the whole UI floats on top of the central nervous system.
export default function NeuralBackground() {
  return (
    <div className="neural-bg" aria-hidden="true">
      <div className="neural-bg__void" />
      <NeuralField className="neural-bg__canvas" density={34} opacity={0.85} />
      <div className="neural-bg__vignette" />
    </div>
  );
}
