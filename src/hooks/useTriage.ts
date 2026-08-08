import { useState } from 'react';
import { TriageInput, TriageGuidanceResult } from '../types/triage';
import { evaluateTriageBackend } from '../services/api';
import { evaluateLocalDeterministicTriage } from '../services/localTriageEngine';
import { indexedDbService } from '../services/indexedDbService';

export function useTriage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageGuidanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const evaluate = async (input: TriageInput, isOnline: boolean): Promise<TriageGuidanceResult> => {
    setLoading(true);
    setError(null);

    try {
      if (isOnline) {
        // Attempt FastAPI backend triage API first
        const backendResult = await evaluateTriageBackend(input);
        if (backendResult) {
          setResult(backendResult);
          return backendResult;
        }
      }

      // Offline or backend unreachable fallback: Use deterministic local rules
      const localResult = evaluateLocalDeterministicTriage(input);
      setResult(localResult);

      // Queue offline triage result for sync when connectivity returns
      await indexedDbService.addPendingSyncItem('triage_log', localResult);

      return localResult;
    } catch {
      setError('Network unavailable. Generated local deterministic safety triage.');
      const localResult = evaluateLocalDeterministicTriage(input);
      setResult(localResult);
      return localResult;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    loading,
    result,
    error,
    evaluate,
    reset
  };
}
