import { useState, useEffect, useCallback } from 'react';
import { calculateSwiss, SwissResult } from '../utils/swiss-logic';

const STORAGE_KEY = 'swiss-calc-params';

export interface CalculatorParams {
  participants: number | string;
  rounds: number | string;
  topCut: number | string;
}

export const useSwissCalculator = () => {
  const [params, setParams] = useState<CalculatorParams>({
    participants: 128,
    rounds: 7,
    topCut: 8
  });

  // Lazy initialization of result
  const [result, setResult] = useState<SwissResult>(() => calculateSwiss(128, 7, 8));

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setParams(parsed);
        // Auto-calculate once on load if valid
        setResult(calculateSwiss(
          Number(parsed.participants) || 0,
          Number(parsed.rounds) || 0,
          Number(parsed.topCut) || 0
        ));
      } catch (e) {
        console.error('Failed to load params', e);
      }
    }
  }, []);

  // Save to local storage whenever params change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  }, [params]);

  const handleCalculate = useCallback(() => {
    const p = Number(params.participants) || 0;
    const r = Number(params.rounds) || 0;
    const t = Number(params.topCut) || 0;
    setResult(calculateSwiss(p, r, t));
  }, [params]);

  const handleReset = useCallback(() => {
    const defaultParams = {
      participants: 128,
      rounds: 7,
      topCut: 8
    };
    setParams(defaultParams);
    setResult(calculateSwiss(128, 7, 8));
  }, []);

  const updateParam = useCallback((key: keyof CalculatorParams, value: string | number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    params,
    result,
    updateParam,
    handleCalculate,
    handleReset
  };
};
