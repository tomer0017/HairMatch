import { useCallback, useState } from 'react';
import type { QualityResult } from '../types';
import { analyzeImageQuality } from '../utils/imageAnalysis';

interface UsePhotoValidationResult {
  analyzing: boolean;
  result: QualityResult | null;
  /** Run quality analysis on a blob and store the result. */
  validate: (blob: Blob) => Promise<QualityResult>;
  /** Clear the current result (e.g. on retake). */
  reset: () => void;
}

/**
 * Wraps the local image-quality analysis with loading + result state so the
 * capture UI can show a spinner and then the pass/fail feedback.
 */
export function usePhotoValidation(): UsePhotoValidationResult {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<QualityResult | null>(null);

  const validate = useCallback(async (blob: Blob): Promise<QualityResult> => {
    setAnalyzing(true);
    try {
      const analysis = await analyzeImageQuality(blob);
      setResult(analysis);
      return analysis;
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => setResult(null), []);

  return { analyzing, result, validate, reset };
}
