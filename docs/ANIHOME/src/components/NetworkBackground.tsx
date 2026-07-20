import { useEffect, useRef } from "react";

interface Node3D {
  x: number;      // Position relative to center
  y: number;
  z: number;
  vx: number;     // Drift velocities
  vy: number;
  vz: number;
  originX: number;
  originY: number;
  originZ: number;
  radius: number;
  opacity: number;
  isSpecialGlow: boolean; // Some nodes are larger bokeh glows
}

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ 
    x: 0, 
    y: 0, 
    targetX: 0, 
    targetY: 0,
    active: false 
  });

  useEffect(() => {
    // Start mouse at center of window so the initial state is balanced
    mouseRef.current.targetX = window.innerWidth / 2;
    mouseRef.current.targetY = window.innerHeight / 2;
    mouseRef.current.x = window.innerWidth / 2;
    mouseRef.current.y = window.innerHeight / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = window.innerWidth / 2;
      mouseRef.current.targetY = window.innerHeight / 2;
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let nodes: Node3D[] = [];

    const initializeNodes = (w: number, h: number) => {
      nodes = [];
      // Richer density for a beautiful intricate lattice matching the reference image
      const density = 0.000065; 
      const nodeCount = Math.floor(w * h * density);
      
      for (let i = 0; i < nodeCount; i++) {
        // Position relative to screen center
        const rx = (Math.random() - 0.5) * w * 1.25;
        const ry = (Math.random() - 0.5) * h * 1.25;
        const rz = (Math.random() - 0.5) * 350; // depth range

        const isSpecial = Math.random() < 0.20; // 20% of nodes are gorgeous blurred out-of-focus bokeh highlights

        nodes.push({
          x: rx,
          y: ry,
          z: rz,
          originX: rx,
          originY: ry,
          originZ: rz,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          vz: (Math.random() - 0.5) * 0.08,
          radius: isSpecial ? 5 + Math.random() * 8 : 1.4 + Math.random() * 2.2,
          opacity: isSpecial ? 0.08 + Math.random() * 0.14 : 0.45 + Math.random() * 0.35,
          isSpecialGlow: isSpecial
        });
      }
    };

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      initializeNodes(rect.width, rect.height);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Smooth rotational state values
    let rotX = 0;
    let rotY = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Smoothly interpolate mouse coordinate updates
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Map mouse offset from center to subtle target rotation angles
      const targetRotY = (mx - cx) * 0.00018; 
      const targetRotX = -(my - cy) * 0.00018;

      // Smooth cinematic glide to rotation target
      rotX += (targetRotX - rotX) * 0.04;
      rotY += (targetRotY - rotY) * 0.04;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Rotate and project points to screen space
      const projectedNodes = nodes.map((node) => {
        // 1. Apply active drift animation
        node.x += node.vx;
        node.y += node.vy;
        node.z += node.vz;

        // Soft boundaries bounce
        const boundaryX = w * 0.65;
        const boundaryY = h * 0.65;
        if (Math.abs(node.x) > boundaryX) node.vx *= -1;
        if (Math.abs(node.y) > boundaryY) node.vy *= -1;
        if (Math.abs(node.z) > 200) node.vz *= -1;

        // Gentle restoration force towards original position to keep stable structure
        const homeX = node.originX - node.x;
        const homeY = node.originY - node.y;
        const homeZ = node.originZ - node.z;
        node.x += homeX * 0.001;
        node.y += homeY * 0.001;
        node.z += homeZ * 0.001;

        // 2. Apply 3D Rotations (around Y then X)
        // Rotate Y
        let x1 = node.x * cosY + node.z * sinY;
        let z1 = -node.x * sinY + node.z * cosY;

        // Rotate X
        let y2 = node.y * cosX - z1 * sinX;
        let z2 = node.y * sinX + z1 * cosX;

        // 3. Perspective Projection
        const fov = 450; // Focal length
        const scale = fov / (fov + z2);
        const projX = cx + x1 * scale;
        const projY = cy + y2 * scale;

        return {
          projX,
          projY,
          depth: z2, // useful for sorting & connection fade
          scale,
          opacity: node.opacity,
          radius: node.radius * scale,
          isSpecialGlow: node.isSpecialGlow
        };
      });

      // Connections calculation & rendering
      const maxDistance = 160; 

      for (let i = 0; i < projectedNodes.length; i++) {
        const n1 = projectedNodes[i];
        
        // Skip rendering connections for extreme out-of-bounds projected positions
        if (n1.projX < -50 || n1.projX > w + 50 || n1.projY < -50 || n1.projY > h + 50) {
          continue;
        }

        // Connect nodes to each other
        for (let j = i + 1; j < projectedNodes.length; j++) {
          const n2 = projectedNodes[j];

          const dx = n1.projX - n2.projX;
          const dy = n1.projY - n2.projY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            // Lines are more luminous if they are in the foreground
            const depthFactor = Math.max(0.15, (250 - (n1.depth + n2.depth) / 2) / 250);
            const proximityFactor = 1 - dist / maxDistance;
            
            // Draw pure brilliant white lines matching the beautiful 2nd/3rd images
            const alpha = proximityFactor * 0.42 * depthFactor;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.7 * depthFactor;
            ctx.beginPath();
            ctx.moveTo(n1.projX, n1.projY);
            ctx.lineTo(n2.projX, n2.projY);
            ctx.stroke();
          }
        }

        // Draw connections to the mouse pointer to satisfy the "reaccione a los movimientos del mouse" instruction
        if (mouseRef.current.active) {
          const mDx = n1.projX - mx;
          const mDy = n1.projY - my;
          const mDist = Math.sqrt(mDx * mDx + mDy * mDy);
          const mouseConnectionRadius = 190;

          if (mDist < mouseConnectionRadius) {
            const proximity = 1 - mDist / mouseConnectionRadius;
            // A delicate web connecting to the mouse
            const mAlpha = proximity * 0.55 * Math.max(0.1, (200 - n1.depth) / 200);
            ctx.strokeStyle = `rgba(255, 255, 255, ${mAlpha})`;
            ctx.lineWidth = 1.0 * proximity;
            ctx.beginPath();
            ctx.moveTo(n1.projX, n1.projY);
            ctx.lineTo(mx, my);
            ctx.stroke();
          }
        }
      }

      // Draw node points
      projectedNodes.forEach((node) => {
        // Skip drawing if way off screen
        if (node.projX < -20 || node.projX > w + 20 || node.projY < -20 || node.projY > h + 20) {
          return;
        }

        if (node.isSpecialGlow) {
          // Large beautiful out-of-focus background bokeh glow sphere
          const radialGrad = ctx.createRadialGradient(
            node.projX, node.projY, 0,
            node.projX, node.projY, node.radius * 2.5
          );
          radialGrad.addColorStop(0, `rgba(255, 255, 255, ${node.opacity * 2.0})`);
          radialGrad.addColorStop(0.3, `rgba(255, 255, 255, ${node.opacity * 1.0})`);
          radialGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
          
          ctx.beginPath();
          ctx.arc(node.projX, node.projY, node.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = radialGrad;
          ctx.fill();
        } else {
          // Sharp, elegant glass beads in the center of the lattice
          ctx.beginPath();
          ctx.arc(node.projX, node.projY, Math.max(0.9, node.radius), 0, Math.PI * 2);
          
          // Make foreground nodes slightly brighter white, background ones soft white/silver
          const brightnessFactor = Math.max(0.3, (250 - node.depth) / 250);
          ctx.fillStyle = `rgba(255, 255, 255, ${node.opacity * brightnessFactor * 1.4})`;
          ctx.fill();

          // Add a very subtle glowing outline to nodes close to the mouse
          if (mouseRef.current.active) {
            const mDx = node.projX - mx;
            const mDy = node.projY - my;
            const mDist = Math.sqrt(mDx * mDx + mDy * mDy);
            if (mDist < 120) {
              ctx.beginPath();
              ctx.arc(node.projX, node.projY, node.radius * 2.2, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - mDist / 120) * 0.4})`;
              ctx.lineWidth = 0.6;
              ctx.stroke();
            }
          }
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      {/* Soft studio gradient background container representing premium desaturated blue-gray studio cyclorama */}
      <div 
        className="absolute inset-0 z-0" 
        style={{ 
          pointerEvents: "none",
          background: "radial-gradient(circle at 50% 50%, #f4f6f9 0%, #dce2e8 55%, #bcc6cf 100%)"
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        id="constellation-network-bg"
      />
    </>
  );
}
