import { useState } from 'react';
import { motion, useAnimation, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Settings2, Volume2, VolumeX, Sun, Zap } from 'lucide-react';
import { useCoinToss } from '../../hooks/useCoinToss';
import { Coin3D } from './Coin3D';
import { playBounceSound } from '../../utils/sound';

interface CoinTossProps {
  onBack: () => void;
}

export default function CoinToss({ onBack }: CoinTossProps) {
  const {
    isFlipping,
    result,
    stats,
    settings,
    updateSettings,
    tossCoin
  } = useCoinToss();

  const [showSettings, setShowSettings] = useState(false);

  // Particles state for toss animation
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  // Animation Controls
  const y = useMotionValue(0);
  const scale = useTransform(y, [0, -400], [1, 1.5]);
  const shadowOpacity = useTransform(y, [0, -400], [0.5, 0.1]);
  const shadowScale = useTransform(y, [0, -400], [1, 0.5]);
  
  // Rotation values driven manually
  const rotateY = useMotionValue(0);
  const rotateX = useMotionValue(0);

  // Main animation sequence controller
  const controls = useAnimation();
  const sceneControls = useAnimation(); // For camera shake

  const handleToss = async () => {
    if (isFlipping) return;

    // Trigger logic
    const tossResult = tossCoin();
    if (!tossResult) return;
    const { duration, targetRotation } = tossResult;

    // Emit particles if quality is high
    if (settings.quality === 'high') {
      const newParticles = Array.from({ length: 15 }).map((_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 100,
        color: settings.material === 'gold' ? '#fbbf24' : settings.material === 'silver' ? '#94a3b8' : '#fb923c'
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 1000);
    }

    // Reset physics state
    y.set(0);

    // 1. Throw Up (approx 40% of duration)
    const upDuration = duration * 0.45;
    const downDuration = duration * 0.45;
    const bounceDuration = duration * 0.1;

    // Start spinning
    animate(rotateY, targetRotation.y, { 
      velocity: 1000,
      type: "spring",
      stiffness: 20,
      damping: 5
    });
    
    // Add random wobble during flight
    animate(rotateX, targetRotation.x, { 
      type: "spring",
      stiffness: 50, 
      damping: 10 
    });

    // Go Up
    await controls.start({
      y: -400,
      transition: { duration: upDuration / 1000, ease: "easeOut" }
    });

    // Fall Down
    await controls.start({
      y: 0,
      transition: { duration: downDuration / 1000, ease: "easeIn" }
    });

    // Bounce Effect (Impact)
    if (settings.soundEnabled) playBounceSound(1);
    
    // Camera Shake on impact
    sceneControls.start({
      y: [0, 5, -5, 2, -2, 0],
      transition: { duration: 0.2 }
    });

    await controls.start({
      y: -60,
      transition: { duration: bounceDuration / 2000, ease: "easeOut" }
    });
    
    await controls.start({
      y: 0,
      transition: { duration: bounceDuration / 2000, ease: "easeIn" }
    });

    // Small settle bounce
    if (settings.soundEnabled) playBounceSound(0.3);
    
    // Final settle
    animate(rotateX, targetRotation.x > 0 ? 5 : -5, { duration: 0.5 });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-hidden flex flex-col relative selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 p-6 flex justify-between items-center max-w-5xl mx-auto w-full">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">返回</span>
        </button>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            className={`p-2 rounded-full transition-colors ${settings.soundEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}
          >
            {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-20 right-6 z-20 w-64 bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-2xl p-4 shadow-xl"
        >
          <h3 className="text-sm font-bold text-slate-300 mb-4">动画设置</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">硬币材质</label>
              <div className="flex gap-2">
                {(['gold', 'silver', 'bronze'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => updateSettings({ material: m })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                      settings.material === m 
                        ? 'bg-indigo-600 border-indigo-500 text-white' 
                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {m === 'gold' ? '金' : m === 'silver' ? '银' : '铜'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">画质</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map(q => (
                  <button
                    key={q}
                    onClick={() => updateSettings({ quality: q })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize border ${
                      settings.quality === q 
                        ? 'bg-indigo-600 border-indigo-500 text-white' 
                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">光线追踪效果</span>
              <button
                onClick={() => updateSettings({ rayTracing: !settings.rayTracing })}
                className={`w-10 h-5 rounded-full relative transition-colors ${settings.rayTracing ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.rayTracing ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <div className="border-t border-slate-700 my-2 pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-slate-300 font-bold">HDR 模式</span>
                </div>
                <button
                  onClick={() => updateSettings({ hdr: !settings.hdr })}
                  className={`w-10 h-5 rounded-full relative transition-colors ${settings.hdr ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.hdr ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-slate-400">亮度调节</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{Math.round(settings.brightness * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2" 
                  step="0.1"
                  value={settings.brightness}
                  onChange={(e) => updateSettings({ brightness: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Scene */}
      <motion.div 
        animate={sceneControls}
        className="flex-1 flex flex-col items-center justify-center relative perspective-container cursor-pointer"
        onClick={handleToss}
        style={{ perspective: '1200px' }}
      >
        <div className="relative z-10 mb-20">
          {/* Instructions / Result */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-full text-center pointer-events-none">
            {!isFlipping && !result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="bg-slate-800/50 backdrop-blur px-4 py-2 rounded-full border border-slate-700/50">
                  <span className="text-slate-300 text-sm">点击屏幕任意位置投掷</span>
                </div>
              </motion.div>
            )}
            
            {result && !isFlipping && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <h2 className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                  {result === 'heads' ? '正面' : '反面'}
                </h2>
                <div className="mt-2 text-indigo-400 font-medium">
                  {result === 'heads' ? 'Heads' : 'Tails'}
                </div>
              </motion.div>
            )}
          </div>

          {/* Coin Container */}
          <motion.div
            animate={controls}
            style={{ y, scale }}
            className="relative"
          >
            {/* Particles Effect */}
            <AnimatePresence>
              {particles.map(p => (
                <motion.div
                  key={p.id}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ 
                    x: p.x * 2, 
                    y: p.y * 2, 
                    opacity: 0, 
                    scale: 0.2,
                    rotate: 360
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full pointer-events-none z-0"
                  style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }}
                />
              ))}
            </AnimatePresence>

            {/* Trail Effect (High Quality Only) */}
            {isFlipping && settings.quality === 'high' && (
               <motion.div 
                 className="absolute inset-0 opacity-30 blur-md scale-105 pointer-events-none"
                 style={{ 
                    rotateY, 
                    rotateX,
                    background: settings.material === 'gold' ? '#fbbf24' : settings.material === 'silver' ? '#94a3b8' : '#fb923c'
                 }} 
               />
            )}

            <Coin3D 
              rotationY={rotateY}
              rotationX={rotateX}
              material={settings.material}
              quality={settings.quality}
              rayTracing={settings.rayTracing}
              hdr={settings.hdr}
              brightness={settings.brightness}
            />
          </motion.div>

          {/* Dynamic Shadow */}
          <motion.div 
            className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-40 h-10 bg-black/40 blur-xl rounded-full"
            style={{ opacity: shadowOpacity, scale: shadowScale }}
          />
        </div>

        {/* Stats Footer */}
        <div className="absolute bottom-10 left-0 right-0 px-6">
          <div className="max-w-md mx-auto bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 flex justify-between items-center">
            <div className="text-center flex-1 border-r border-slate-700/50">
              <div className="text-2xl font-bold text-white">{stats.total}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total</div>
            </div>
            <div className="text-center flex-1 border-r border-slate-700/50">
              <div className="text-2xl font-bold text-yellow-500">{stats.heads}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Heads</div>
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold text-slate-400">{stats.tails}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Tails</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
