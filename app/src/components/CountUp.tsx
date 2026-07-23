import { useCountUp } from '../hooks/useCountUp';

/** Renders a number that counts up to `value`, formatted (e.g. into cedis). */
export default function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value);
  return <>{format(v)}</>;
}
