import React from 'react';
import { Tool } from '../types';

interface ToolbarProps {
  file: File | null;
  activeTool: Tool;
  scale: number;
  showGrid: boolean;
  isBlueprint: boolean;
  onToolChange: (tool: Tool) => void;
  onZoom: (delta: number) => void;
  onRotate: () => void;
  onShowGridToggle: () => void;
  onBlueprintToggle: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  sidebarVisible: boolean;
  onSidebarToggle: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  file,
  activeTool,
  scale,
  showGrid,
  isBlueprint,
  onToolChange,
  onZoom,
  onRotate,
  onShowGridToggle,
  onBlueprintToggle,
  theme,
  onThemeToggle,
  sidebarVisible,
  onSidebarToggle,
}) => {
  return (
    <header className="h-[60px] bg-[var(--bg-white)] border-b border-[var(--border-color)] px-4 flex items-center justify-between z-30 shadow-[0_2px_4px_rgba(0,0,0,0.05)] transition-colors duration-200">
      <div className="flex items-center gap-2">
        <button 
          onClick={() => window.history.back()}
          className="toolbar-btn w-9 h-9"
          title="Volver"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <button
          onClick={onSidebarToggle}
          className={`toolbar-btn w-9 h-9 ${sidebarVisible ? 'toolbar-btn-active' : ''}`}
          title={sidebarVisible ? 'Ocultar panel de planos' : 'Mostrar panel de planos'}
        >
          <i className="fa-solid fa-bars text-sm"></i>
        </button>
        <div className="flex items-center gap-2 ml-2">
          <a href="../home.html" title="Volver al Home" className="flex items-center">
            <img 
              id="logo-img"
              src={theme === 'dark' ? 'https://i.postimg.cc/FFfBKzb8/LOGO-TEXTO-NORA-BLANCO.png' : 'https://i.postimg.cc/L4r0gSvV/LOGO-TEXTO-NORA-NEGRO.png'} 
              alt="nora CDE" 
              className="logo-img select-none h-[65px] max-md:h-[32px]"
              draggable={false}
            />
          </a>
        </div>
        {file && <div className="toolbar-divider"></div>}
        {file && (
          <span className="text-[11px] font-semibold text-[var(--text-dark-gray)] truncate max-w-[150px]">
            {file.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 mr-2">
          <button 
            onClick={() => onToolChange('hand')} 
            className={`toolbar-btn w-9 h-9 ${activeTool === 'hand' ? 'toolbar-btn-active' : ''}`} 
            title="Mano (Pan)"
          >
            <i className="fa-solid fa-hand-pointer text-xs"></i>
          </button>
          <button 
            onClick={() => onToolChange('measure')} 
            className={`toolbar-btn w-9 h-9 ${activeTool === 'measure' ? 'toolbar-btn-active' : ''}`} 
            title="Medir"
          >
            <i className="fa-solid fa-ruler text-xs"></i>
          </button>
          <button 
            onClick={() => onToolChange('calibrate')} 
            className={`toolbar-btn w-9 h-9 ${activeTool === 'calibrate' ? 'toolbar-btn-active' : ''}`} 
            title="Calibrar Escala"
          >
            <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <div className="flex items-center gap-1 mr-2">
          <button 
            onClick={() => onZoom(-0.2)} 
            className="toolbar-btn w-7 h-7"
            title="Zoom menos"
          >
            <i className="fa-solid fa-minus text-[10px]"></i>
          </button>
          <span className="text-[11px] font-mono font-bold w-12 text-center text-[var(--text-dark-gray)]">
            {Math.round(scale * 100)}%
          </span>
          <button 
            onClick={() => onZoom(0.2)} 
            className="toolbar-btn w-7 h-7"
            title="Zoom más"
          >
            <i className="fa-solid fa-plus text-[10px]"></i>
          </button>
        </div>

        <div className="toolbar-divider"></div>

        <button 
          onClick={onRotate} 
          className="toolbar-btn w-9 h-9" 
          title="Rotar"
        >
          <i className="fa-solid fa-rotate-right text-xs"></i>
        </button>
        <button 
          onClick={onShowGridToggle} 
          className={`toolbar-btn w-9 h-9 ${showGrid ? 'toolbar-btn-active' : ''}`} 
          title="Grid"
        >
          <i className="fa-solid fa-border-none text-xs"></i>
        </button>
        <button 
          onClick={onBlueprintToggle} 
          className={`toolbar-btn w-9 h-9 ${isBlueprint ? 'toolbar-btn-active' : ''}`} 
          title="Modo plano (alto contraste)"
        >
          <i className="fa-solid fa-file-lines text-xs"></i>
        </button>
        <button 
          onClick={onThemeToggle} 
          className="toolbar-btn w-9 h-9" 
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
        </button>
      </div>

      <div className="flex items-center gap-3" />
    </header>
  );
};

export default Toolbar;
