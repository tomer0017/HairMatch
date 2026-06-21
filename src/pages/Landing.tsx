import { LandingPage } from '../components/LandingPage';

interface LandingProps {
  onStart: () => void;
}

/** Welcome screen wrapper. */
export function Landing({ onStart }: LandingProps) {
  return <LandingPage onStart={onStart} />;
}
