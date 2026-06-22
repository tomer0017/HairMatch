import { useCallback, useState } from 'react';
import { Questionnaire } from './components/Questionnaire';
import { PHOTO_STEPS } from './config/steps';
import { CaptureFlow } from './pages/CaptureFlow';
import { Landing } from './pages/Landing';
import { Review } from './pages/Review';
import type { AppScreen, CapturedPhoto, HairProfile } from './types';

/**
 * Root component. Owns the high-level screen state and the captured photos.
 *
 * All photos live in React state only — nothing is uploaded or persisted, in
 * line with the privacy-first, frontend-only design.
 */
export default function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [photos, setPhotos] = useState<Record<string, CapturedPhoto>>({});
  const [startIndex, setStartIndex] = useState(0);
  const [captureMode, setCaptureMode] = useState<'sequential' | 'single'>('sequential');
  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null);

  // Store a confirmed photo, revoking the previous object URL if we're replacing.
  const setPhoto = useCallback((stepId: string, photo: CapturedPhoto) => {
    setPhotos((prev) => {
      const existing = prev[stepId];
      if (existing) URL.revokeObjectURL(existing.url);
      return { ...prev, [stepId]: photo };
    });
  }, []);

  // Landing → questionnaire. The camera is only opened once both questions are
  // answered, so the questionnaire always precedes the sequential capture.
  const handleStart = useCallback(() => setScreen('questionnaire'), []);

  const handleQuestionnaireComplete = useCallback((profile: HairProfile) => {
    setHairProfile(profile);
    setStartIndex(0);
    setCaptureMode('sequential');
    setScreen('capture');
  }, []);

  const handleCaptureExit = useCallback(() => setScreen('review'), []);

  const handleRetake = useCallback((stepIndex: number) => {
    setStartIndex(stepIndex);
    setCaptureMode('single');
    setScreen('capture');
  }, []);

  const handleBackToLanding = useCallback(() => setScreen('landing'), []);

  if (screen === 'landing') {
    return (
      <main className="app-shell">
        <Landing onStart={handleStart} />
      </main>
    );
  }

  if (screen === 'questionnaire') {
    return (
      <main className="app-shell">
        <Questionnaire
          onComplete={handleQuestionnaireComplete}
          onBack={handleBackToLanding}
        />
      </main>
    );
  }

  if (screen === 'capture') {
    return (
      <main className="app-shell">
        <CaptureFlow
          steps={PHOTO_STEPS}
          startIndex={startIndex}
          mode={captureMode}
          onConfirm={setPhoto}
          onExit={handleCaptureExit}
          onBackToLanding={handleBackToLanding}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Review
        steps={PHOTO_STEPS}
        photos={photos}
        hairProfile={hairProfile}
        onRetake={handleRetake}
      />
    </main>
  );
}
