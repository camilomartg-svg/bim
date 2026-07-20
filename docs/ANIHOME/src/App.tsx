import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Compass, 
  MapPin, 
  Layers, 
  Info 
} from "lucide-react";
import RockCanvas from "./components/RockCanvas";
import NetworkBackground from "./components/NetworkBackground";
import { cdeBimProperties, CdeFeature } from "./data/cdeFeatures";

export default function App() {
  const [explosionFactor, setExplosionFactor] = useState<number>(0.15); // Fine separation
  const [hoveredFaceIndex, setHoveredFaceIndex] = useState<number | null>(null);
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Track global cursor coordinates for smooth real-time tooltip position
  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Determine active face to display its corresponding CDE BIM property
  const activeFaceIndex = selectedFaceIndex !== null ? selectedFaceIndex : hoveredFaceIndex;
  
  const activeFeature = useMemo((): CdeFeature | null => {
    if (activeFaceIndex === null) return null;
    return cdeBimProperties[activeFaceIndex % cdeBimProperties.length];
  }, [activeFaceIndex]);

  return (
    <div 
      id="colombia-bim-app" 
      className="relative w-screen h-screen bg-[#fcfdfe] text-slate-800 font-sans overflow-hidden select-none"
    >
      {/* 1. Luminous Interactive Constellation Network Background (Reacts to Mouse) */}
      <NetworkBackground />

      {/* 2. Overwhelmingly Majestic 3D Interactive Rock (Foreground) */}
      <div className="absolute inset-0 w-full h-full z-10 pointer-events-auto">
        <RockCanvas
          explosionFactor={explosionFactor}
          setExplosionFactor={setExplosionFactor}
          hoveredFaceIndex={hoveredFaceIndex}
          setHoveredFaceIndex={setHoveredFaceIndex}
          selectedFaceIndex={selectedFaceIndex}
          setSelectedFaceIndex={setSelectedFaceIndex}
        />
      </div>

      {/* 3. Real-Time Elegant Companion Floating Tag Label */}
      <AnimatePresence>
        {activeFeature && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            style={{
              position: "fixed",
              left: mousePos.x + 18,
              top: mousePos.y - 25,
            }}
            className="z-50 pointer-events-none flex items-center gap-2"
          >
            {/* Minimal clean pill structure with CDE title and category */}
            <div className="bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-lg border border-slate-200/80 shadow-[0_4px_20px_rgba(148,163,184,0.12)] flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 tracking-tight">
                  {activeFeature.title}
                </span>
              </div>
              <span className="bg-red-50 text-red-600 font-mono font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border border-red-100/50 shrink-0">
                {activeFeature.category}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
