import { useEffect, useRef, useState, useMemo, MouseEvent } from "react";
import { cdeBimProperties, CdeFeature } from "../data/cdeFeatures";

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Face2D {
  index: number;
  points: { x: number; y: number }[];
  depth: number;
  normal: Point3D;
  centroid: Point3D;
  originalCentroidProj: { x: number; y: number };
}

interface RockCanvasProps {
  explosionFactor: number; // 0 (fully joined) to 1 (fully separated)
  setExplosionFactor: (val: number) => void;
  hoveredFaceIndex: number | null;
  setHoveredFaceIndex: (idx: number | null) => void;
  selectedFaceIndex: number | null;
  setSelectedFaceIndex: (idx: number | null) => void;
}

export default function RockCanvas({
  explosionFactor,
  setExplosionFactor,
  hoveredFaceIndex,
  setHoveredFaceIndex,
  selectedFaceIndex,
  setSelectedFaceIndex
}: RockCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Keep values in mutable refs to achieve a true, uninterrupted, 60+ FPS rendering loop
  const rotationRef = useRef({ x: -0.3, y: 0.5 });
  const targetRotationRef = useRef({ x: -0.3, y: 0.5 });
  const mouseCanvasPosRef = useRef({ x: -1000, y: -1000 });
  const isRotatingAutomaticallyRef = useRef(true);
  const interactionOffsetRef = useRef({ x: 0, y: 0 });

  // Sync props to refs to avoid recreating the effect hook
  const explosionFactorRef = useRef(explosionFactor);
  const hoveredFaceIndexRef = useRef(hoveredFaceIndex);
  const selectedFaceIndexRef = useRef(selectedFaceIndex);

  useEffect(() => {
    explosionFactorRef.current = explosionFactor;
  }, [explosionFactor]);

  useEffect(() => {
    hoveredFaceIndexRef.current = hoveredFaceIndex;
  }, [hoveredFaceIndex]);

  useEffect(() => {
    selectedFaceIndexRef.current = selectedFaceIndex;
  }, [selectedFaceIndex]);

  // Procedural rock structure generation: Large crystal with multiple vertices & faces
  const { vertices, faces } = useMemo(() => {
    const verts: Point3D[] = [];
    const fcs: number[][] = [];
    
    // Low poly counts: fewer divisions, bigger facets
    const LAT_STEPS = 4 + Math.floor(Math.random() * 3); // ranges 4 to 6
    const LON_STEPS = 8 + Math.floor(Math.random() * 4);  // ranges 8 to 11
    
    // Top Pole vertex with a slight random height perturbation
    const topHeight = 1.4 + Math.random() * 0.4;
    verts.push({ x: 0, y: topHeight, z: 0 });
    
    // Generate a set of random sine/cosine waves for procedural shape variation on reload
    const waves = Array.from({ length: 4 }, () => ({
      freqPhi: Math.random() * 3 + 1,
      freqTheta: Math.random() * 3 + 1,
      amp: Math.random() * 0.25 + 0.08,
      phase: Math.random() * Math.PI
    }));

    // Randomize general elongation along axes
    const scaleX = 0.9 + Math.random() * 0.3;
    const scaleY = 0.9 + Math.random() * 0.3;
    const scaleZ = 0.9 + Math.random() * 0.3;
    
    // Intermediate ring coordinates
    for (let lat = 1; lat < LAT_STEPS; lat++) {
      const phi = (lat / LAT_STEPS) * Math.PI;
      for (let lon = 0; lon < LON_STEPS; lon++) {
        const theta = (lon / LON_STEPS) * 2 * Math.PI;
        
        // Accumulate procedural waves for highly organic, crystal-like structures
        let dist = 1.0;
        waves.forEach(w => {
          dist += w.amp * Math.sin(phi * w.freqPhi + w.phase) * Math.cos(theta * w.freqTheta + w.phase);
        });
        
        const radius = 1.42 * dist;
        const x = radius * Math.sin(phi) * Math.cos(theta) * scaleX;
        const y = radius * Math.cos(phi) * scaleY;
        const z = radius * Math.sin(phi) * Math.sin(theta) * scaleZ;
        
        verts.push({ x, y, z });
      }
    }
    
    // Bottom Pole vertex with a slight random depth perturbation
    const bottomHeight = -(1.4 + Math.random() * 0.4);
    verts.push({ x: 0, y: bottomHeight, z: 0 });
    
    // 2. Triangular Face connections
    // Top Cap (pole 0 connected to Ring 1)
    for (let i = 0; i < LON_STEPS; i++) {
      const v0 = 0;
      const v1 = 1 + i;
      const v2 = 1 + ((i + 1) % LON_STEPS);
      fcs.push([v0, v1, v2]);
    }
    
    // Intermediate Rings Bands
    for (let b = 0; b < LAT_STEPS - 2; b++) {
      const rA = 1 + b * LON_STEPS;
      const rB = 1 + (b + 1) * LON_STEPS;
      for (let i = 0; i < LON_STEPS; i++) {
        const next_i = (i + 1) % LON_STEPS;
        fcs.push([rA + i, rB + i, rB + next_i]);
        fcs.push([rA + i, rB + next_i, rA + next_i]);
      }
    }
    
    // Bottom Cap (connected to bottom pole)
    const bPole = verts.length - 1;
    const rLast = 1 + (LAT_STEPS - 2) * LON_STEPS;
    for (let i = 0; i < LON_STEPS; i++) {
      const v1 = rLast + ((i + 1) % LON_STEPS);
      const v2 = rLast + i;
      fcs.push([bPole, v1, v2]);
    }
    
    return { vertices: verts, faces: fcs };
  }, []);

  // Ray-cast test against mouse coordinate to check polygon inclusion
  const isPointInPolygon = (px: number, py: number, points: { x: number; y: number }[]) => {
    let isInside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      const intersect = ((yi > py) !== (yj > py))
        && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  };

  // Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;

    const render = () => {
      // Dynamic device pixel ratio resize
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const w = rect.width;
      const h = rect.height;

      // Clean viewport with subtle lighting gradient
      ctx.clearRect(0, 0, w, h);

      // Interpolate automatic / manual orbital rotation
      const easeSpeed = 0.04; // Extremely smooth, cinematic glides
      if (isRotatingAutomaticallyRef.current) {
        targetRotationRef.current.y += 0.0025; // Subtle float rotation
      }
      
      rotationRef.current.x += (targetRotationRef.current.x - rotationRef.current.x) * easeSpeed;
      rotationRef.current.y += (targetRotationRef.current.y - rotationRef.current.y) * easeSpeed;

      const cosX = Math.cos(rotationRef.current.x);
      const sinX = Math.sin(rotationRef.current.x);
      const cosY = Math.cos(rotationRef.current.y);
      const sinY = Math.sin(rotationRef.current.y);

      // Rotate points in 3D
      const rotate3D = (p: Point3D): Point3D => {
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.x * sinY + p.z * cosY;
        let y2 = p.y * cosX - z1 * sinX;
        let z2 = p.y * sinX + z1 * cosX;
        return { x: x1, y: y2, z: z2 };
      };

      const scale = Math.min(w, h) * 0.44; // Magnified majestic scale
      const cameraDist = 4.2;
      const maxExplodeDist = 1.15;

      const rotatedVertices = vertices.map(v => rotate3D(v));

      // Build face list
      const faceList: Face2D[] = faces.map((indices, idx) => {
        const v0 = rotatedVertices[indices[0]];
        const v1 = rotatedVertices[indices[1]];
        const v2 = rotatedVertices[indices[2]];

        const centroid: Point3D = {
          x: (v0.x + v1.x + v2.x) / 3,
          y: (v0.y + v1.y + v2.y) / 3,
          z: (v0.z + v1.z + v2.z) / 3
        };

        const centroidLen = Math.sqrt(centroid.x * centroid.x + centroid.y * centroid.y + centroid.z * centroid.z);
        const normal: Point3D = {
          x: centroid.x / centroidLen,
          y: centroid.y / centroidLen,
          z: centroid.z / centroidLen
        };

        const origZ = centroid.z + cameraDist;
        const origProj = {
          x: w / 2 + (centroid.x * scale) / origZ,
          y: h / 2 + (centroid.y * scale) / origZ
        };

        // Explode vertices along outward face normal
        const offset = explosionFactorRef.current * maxExplodeDist;
        const exploded3D = [v0, v1, v2].map(v => ({
          x: v.x + normal.x * offset,
          y: v.y + normal.y * offset,
          z: v.z + normal.z * offset
        }));

        const points2D = exploded3D.map(p => {
          const depthZ = p.z + cameraDist;
          return {
            x: w / 2 + (p.x * scale) / depthZ,
            y: h / 2 + (p.y * scale) / depthZ
          };
        });

        const avgDepth = (exploded3D[0].z + exploded3D[1].z + exploded3D[2].z) / 3;

        return {
          index: idx,
          points: points2D,
          depth: avgDepth,
          normal,
          centroid,
          originalCentroidProj: origProj
        };
      });

      // Find top hovered face
      let topHoveredIdx = -1;
      const sortedCloseness = [...faceList].sort((a, b) => a.depth - b.depth);
      for (const face of sortedCloseness) {
        if (isPointInPolygon(mouseCanvasPosRef.current.x, mouseCanvasPosRef.current.y, face.points)) {
          topHoveredIdx = face.index;
          break;
        }
      }

      if (topHoveredIdx !== hoveredFaceIndexRef.current) {
        setHoveredFaceIndex(topHoveredIdx === -1 ? null : topHoveredIdx);
      }

      // Painter's Algorithm: Sort back-to-front (furthest first)
      const sortedBackToFront = [...faceList].sort((a, b) => b.depth - a.depth);

      // Light direction: Top-Left-Front
      const lightSource: Point3D = { x: -0.6, y: -0.8, z: -1.2 };
      const lightLen = Math.sqrt(lightSource.x * lightSource.x + lightSource.y * lightSource.y + lightSource.z * lightSource.z);
      const lightNorm = { x: lightSource.x / lightLen, y: lightSource.y / lightLen, z: lightSource.z / lightLen };

      sortedBackToFront.forEach((face) => {
        const isHovered = face.index === topHoveredIdx;
        const isSelected = face.index === selectedFaceIndexRef.current;

        // Illumination brightness (light theme - luminous, bright pearlescent whites and platinum grays)
        const dotProd = face.normal.x * lightNorm.x + face.normal.y * lightNorm.y + face.normal.z * lightNorm.z;
        
        // Pure illuminated mapping
        const brightness = Math.max(0.35, (dotProd + 1) / 2);

        // Draw structural connection lines when exploded
        if (explosionFactorRef.current > 0.05) {
          ctx.beginPath();
          ctx.moveTo(face.originalCentroidProj.x, face.originalCentroidProj.y);
          const explCentroid = {
            x: (face.points[0].x + face.points[1].x + face.points[2].x) / 3,
            y: (face.points[0].y + face.points[1].y + face.points[2].y) / 3
          };
          ctx.lineTo(explCentroid.x, explCentroid.y);
          ctx.strokeStyle = isHovered 
            ? "rgba(239, 68, 68, 0.85)" 
            : "rgba(200, 200, 200, 0.22)";
          ctx.lineWidth = isHovered ? 1.4 : 0.6;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw the polygon face
        ctx.beginPath();
        ctx.moveTo(face.points[0].x, face.points[0].y);
        ctx.lineTo(face.points[1].x, face.points[1].y);
        ctx.lineTo(face.points[2].x, face.points[2].y);
        ctx.closePath();

        let fillStyle = "";
        let strokeStyle = "";
        let lineWidth = 0.8;

        if (isHovered || isSelected) {
          // Luminous white face with a strong glowing red border & red outer bloom
          fillStyle = `rgba(255, 255, 255, 0.98)`;
          strokeStyle = "#ef4444";
          lineWidth = 2.4;
          
          // Brilliant red outer bloom/glow
          ctx.shadowColor = "rgba(239, 68, 68, 1.0)";
          ctx.shadowBlur = 35;
        } else {
          // Pearlescent metallic silver shades (Highly luminous neutral white/gray palette)
          const baseShade = Math.floor(232 + brightness * 18); // ranges 232-250 (subtle metallic contrast)
          fillStyle = `rgba(${baseShade}, ${baseShade}, ${baseShade}, 0.86)`;
          strokeStyle = "rgba(200, 200, 200, 0.5)";
          lineWidth = 0.8;
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Reset shadows so they don't leak
        ctx.shadowBlur = 0;

        // Front-facing vertex points draw (as micro red or gray beads)
        if (face.centroid.z < 0) {
          face.points.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, isHovered ? 2.5 : 1.2, 0, 2 * Math.PI);
            ctx.fillStyle = isHovered ? "#ef4444" : "rgba(200, 200, 200, 0.4)";
            ctx.fill();
          });
        }
      });

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [vertices, faces, setHoveredFaceIndex]);

  // Handle cursor positioning & rotation tilt
  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseCanvasPosRef.current = { x, y };

    const normX = (x / rect.width) * 2 - 1;
    const normY = (y / rect.height) * 2 - 1;

    const targetX = normY * 0.7 - 0.2;
    const targetY = normX * 1.2;

    if (isRotatingAutomaticallyRef.current) {
      isRotatingAutomaticallyRef.current = false;
      interactionOffsetRef.current = {
        x: rotationRef.current.x - targetX,
        y: rotationRef.current.y - targetY
      };
    }

    targetRotationRef.current = {
      x: targetX + interactionOffsetRef.current.x,
      y: targetY + interactionOffsetRef.current.y
    };
  };

  const handleMouseLeave = () => {
    mouseCanvasPosRef.current = { x: -1000, y: -1000 };
    isRotatingAutomaticallyRef.current = true;
    
    // Smoothly reset the targets to continue current flow smoothly
    targetRotationRef.current = {
      x: -0.3,
      y: rotationRef.current.y
    };
  };

  const handleCanvasClick = () => {
    if (hoveredFaceIndex !== null) {
      setSelectedFaceIndex(hoveredFaceIndex === selectedFaceIndex ? null : hoveredFaceIndex);
    } else {
      setSelectedFaceIndex(null);
    }
  };

  // Support scroll to explode / join
  useEffect(() => {
    const handleScroll = (e: WheelEvent) => {
      e.preventDefault();
      const sensitivity = 0.0015;
      setExplosionFactor(Math.max(0, Math.min(1, explosionFactor + e.deltaY * sensitivity)));
    };

    const canvasEl = canvasRef.current;
    if (canvasEl) {
      canvasEl.addEventListener("wheel", handleScroll, { passive: false });
    }

    return () => {
      if (canvasEl) {
        canvasEl.removeEventListener("wheel", handleScroll);
      }
    };
  }, [explosionFactor, setExplosionFactor]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
        style={{ filter: "blur(0.2px)" }}
        className="w-full h-full cursor-pointer touch-none block"
        id="crystal-rock-canvas"
      />
    </div>
  );
}
