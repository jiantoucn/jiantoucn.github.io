import { useState, useCallback } from 'react';
import { playTossSound, playLandSound } from '../utils/sound';

export type CoinMaterial = 'gold' | 'silver' | 'bronze';
export type GraphicsQuality = 'low' | 'medium' | 'high';

interface CoinSettings {
  material: CoinMaterial;
  quality: GraphicsQuality;
  soundEnabled: boolean;
  rayTracing: boolean;
  hdr: boolean;
  brightness: number;
}

export const useCoinToss = () => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState({ heads: 0, tails: 0, total: 0 });
  const [testResults, setTestResults] = useState<{ heads: number; tails: number; total: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  const [settings, setSettings] = useState<CoinSettings>({
    material: 'gold',
    quality: 'high',
    soundEnabled: true,
    rayTracing: true,
    hdr: true,
    brightness: 1.2
  });

  const tossCoin = useCallback(() => {
    if (isFlipping) return;

    setIsFlipping(true);
    setResult(null); // Clear previous result display during flip
    
    if (settings.soundEnabled) {
      playTossSound();
    }

    // Use crypto.getRandomValues for fairness
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const isHeads = array[0] % 2 === 0;
    const newResult = isHeads ? 'heads' : 'tails';

    // Calculate target rotations
    // Minimum 3 full spins (1080 degrees) + random extra
    const minSpins = 3;
    const extraSpins = Math.random() * 2; // 0-2 extra spins
    const totalYRotations = (minSpins + extraSpins) * 360 + (isHeads ? 0 : 180);
    
    // Add some X-axis rotation for wobble/realism (max 30-45 degrees tilt)
    const xTilt = (Math.random() - 0.5) * 60; 

    // We don't set rotation state directly for animation here if we use Framer Motion controls in component,
    // but we provide the target for the component to consume.
    // However, to keep state managed, we can expose the target.
    
    // Simulate async duration
    const duration = 1500 + Math.random() * 500; // 1.5-2s

    setTimeout(() => {
      if (settings.soundEnabled) {
        playLandSound(settings.material);
      }
      setIsFlipping(false);
      setResult(newResult);
      setRotation(prev => ({ 
        x: xTilt, 
        y: prev.y + totalYRotations 
      }));
      setStats(prev => ({
        ...prev,
        [newResult]: prev[newResult] + 1,
        total: prev.total + 1
      }));
    }, duration);
    
    return {
      result: newResult,
      duration,
      targetRotation: {
        y: totalYRotations,
        x: xTilt
      }
    };
  }, [isFlipping, settings]);

  const updateSettings = useCallback((newSettings: Partial<CoinSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const runAutomationTest = useCallback(() => {
    setIsTesting(true);
    setTimeout(() => {
      const iterations = 10000;
      const results = { heads: 0, tails: 0, total: iterations };
      const array = new Uint32Array(iterations);
      window.crypto.getRandomValues(array);

      for (let i = 0; i < iterations; i++) {
        if (array[i] % 2 === 0) {
          results.heads++;
        } else {
          results.tails++;
        }
      }
      setTestResults(results);
      setIsTesting(false);
    }, 500);
  }, []);

  return {
    isFlipping,
    result,
    rotation, // Current/Target rotation state
    stats,
    testResults,
    isTesting,
    settings,
    updateSettings,
    tossCoin,
    runAutomationTest
  };
};
