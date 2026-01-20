import { motion, useTransform, MotionValue } from 'framer-motion';
import { CoinMaterial, GraphicsQuality } from '../../hooks/useCoinToss';

interface Coin3DProps {
  rotationY: MotionValue<number>;
  rotationX: MotionValue<number>;
  material: CoinMaterial;
  quality: GraphicsQuality;
  rayTracing: boolean;
  hdr: boolean;
  brightness: number;
  size?: number;
}

const materials = {
  gold: {
    face: 'bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700',
    edge: 'bg-yellow-800',
    text: 'text-yellow-900',
    border: 'border-yellow-600',
    shimmer: 'from-transparent via-yellow-100/50 to-transparent'
  },
  silver: {
    face: 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-600',
    edge: 'bg-slate-700',
    text: 'text-slate-800',
    border: 'border-slate-500',
    shimmer: 'from-transparent via-white/50 to-transparent'
  },
  bronze: {
    face: 'bg-gradient-to-br from-orange-300 via-orange-500 to-orange-800',
    edge: 'bg-orange-900',
    text: 'text-orange-950',
    border: 'border-orange-700',
    shimmer: 'from-transparent via-orange-200/40 to-transparent'
  }
};

export const Coin3D = ({ 
  rotationY, 
  rotationX,
  material = 'gold', 
  quality = 'high',
  rayTracing = true,
  hdr = true,
  brightness = 1.2,
  size = 160 
}: Coin3DProps) => {
  const styles = materials[material];
  
  // HDR simulation using brightness and contrast
  const filterStyle = hdr 
    ? `brightness(${brightness * 1.2}) contrast(1.1) saturate(1.2) drop-shadow(0 0 10px rgba(255,255,255,${(brightness - 1) * 0.5}))`
    : `brightness(${brightness})`;

  // Layer stacking for 3D thickness
  const thickness = quality === 'high' ? 12 : quality === 'medium' ? 6 : 2;
  const layers = Array.from({ length: thickness });

  // Dynamic light reflection simulation
  // We map rotation to a gradient position to simulate light moving across the surface
  const shine = useTransform(rotationY, (deg) => {
    return `${(deg % 360) / 3.6}%`;
  });

  return (
    <motion.div
      className="relative"
      style={{ 
        width: size, 
        height: size,
        rotateY: rotationY,
        rotateX: rotationX,
        transformStyle: 'preserve-3d',
        filter: filterStyle
      }}
    >
      {/* Thickness Layers (Edge) */}
      {layers.map((_, i) => (
        <div
          key={i}
          className={`absolute inset-0 rounded-full ${styles.edge}`}
          style={{
            transform: `translateZ(-${i}px)`,
            backfaceVisibility: 'visible',
            width: '100%',
            height: '100%'
          }}
        />
      ))}

      {/* Front Face (Heads) */}
      <div 
        className={`absolute inset-0 rounded-full ${styles.face} border-4 ${styles.border} flex items-center justify-center shadow-inner backface-hidden`}
        style={{ transform: 'translateZ(1px)' }}
      >
        <div className={`w-[80%] h-[80%] rounded-full border-2 ${styles.border} border-dashed flex items-center justify-center`}>
           <span className={`text-4xl font-black ${styles.text}`}>正</span>
        </div>
        
        {/* Ray Tracing / Shine Effect */}
        {rayTracing && (
          <motion.div 
            className={`absolute inset-0 rounded-full bg-gradient-to-tr ${styles.shimmer}`}
            style={{ 
              backgroundPosition: shine,
              backgroundSize: '200% 200%',
              mixBlendMode: 'overlay'
            }}
          />
        )}
      </div>

      {/* Back Face (Tails) */}
      <div 
        className={`absolute inset-0 rounded-full ${styles.face} border-4 ${styles.border} flex items-center justify-center shadow-inner`}
        style={{ 
          transform: `translateZ(-${thickness}px) rotateY(180deg)`,
          backfaceVisibility: 'hidden' 
        }}
      >
         <div className={`w-[80%] h-[80%] rounded-full border-2 ${styles.border} flex items-center justify-center`}>
           <span className={`text-4xl font-black ${styles.text}`}>反</span>
        </div>

        {/* Ray Tracing / Shine Effect (Back) */}
        {rayTracing && (
          <motion.div 
            className={`absolute inset-0 rounded-full bg-gradient-to-tr ${styles.shimmer}`}
            style={{ 
              backgroundPosition: shine,
              backgroundSize: '200% 200%',
              mixBlendMode: 'overlay'
            }}
          />
        )}
      </div>
    </motion.div>
  );
};
