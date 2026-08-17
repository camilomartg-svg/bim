/**
 * Enhanced Model Loader - v2.1
 * Fetches all 26+ file types from Google Apps Script backend
 * Groups files by type with expandable/collapsible sections
 */

// Track loaded models
const loadedModels = new Map();

// Google Apps Script endpoint - CONFIGURE THIS with your deployment URL
const GAS_ENDPOINT = 'https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercallback';

// Map of file extensions to friendly names and icons
const FILE_TYPE_CONFIG = {
  '.frag': { name: 'Fragmentos (FRAG)', icon: 'fa-cube', order: 1 },
  '.ifc': { name: 'Modelos IFC', icon: 'fa-building', order: 2 },
  '.json': { name: 'Datos JSON', icon: 'fa-code', order: 3 },
  '.landxml': { name: 'LandXML', icon: 'fa-map', order: 4 },
  '.citygml': { name: 'CityGML', icon: 'fa-city', order: 5 },
  '.rvt': { name: 'Revit (RVT)', icon: 'fa-project-diagram', order: 6 },
  '.rfa': { name: 'Revit Family (RFA)', icon: 'fa-puzzle-piece', order: 7 },
  '.rte': { name: 'Revit Template (RTE)', icon: 'fa-file-lines', order: 8 },
  '.pln': { name: 'ArchiCAD (PLN)', icon: 'fa-layer-group', order: 9 },
  '.pla': { name: 'Planar', icon: 'fa-square', order: 10 },
  '.mod': { name: 'Modelos (MOD)', icon: 'fa-box', order: 11 },
  '.imodel': { name: 'iModel', icon: 'fa-gem', order: 12 },
  '.vwx': { name: 'Vectorworks (VWX)', icon: 'fa-draw-polygon', order: 13 },
  '.ndw': { name: 'Microstation (NDW)', icon: 'fa-drafting-compass', order: 14 },
  '.cyp': { name: 'Cyclone (CYP)', icon: 'fa-spinner', order: 15 },
  '.nwc': { name: 'Navisworks Cache (NWC)', icon: 'fa-cubes', order: 16 },
  '.nwf': { name: 'Navisworks File (NWF)', icon: 'fa-file', order: 17 },
  '.nwd': { name: 'Navisworks Dataset (NWD)', icon: 'fa-database', order: 18 },
  '.smc': { name: 'Sketch-Up Modelo', icon: 'fa-mountain', order: 19 },
  '.e57': { name: 'E57 (Nube de puntos)', icon: 'fa-cloud', order: 20 },
  '.pts': { name: 'PTS (Nube de puntos)', icon: 'fa-circle-notch', order: 21 },
  '.xyz': { name: 'XYZ (Nube de puntos)', icon: 'fa-circle', order: 22 },
  '.las': { name: 'LAS (Nube de puntos)', icon: 'fa-asterisk', order: 23 },
  '.laz': { name: 'LAZ (Nube de puntos comprimida)', icon: 'fa-compress', order: 24 },
  '.rcp': { name: 'ReCap Project (RCP)', icon: 'fa-camera', order: 25 },
  '.rcs': { name: 'ReCap Scan (RCS)', icon: 'fa-image', order: 26 }
};

/**
 * Get file extension from a path
 */
function getFileExtension(path) {
  if (!path || typeof path !== 'string') return '';
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return '';
  return path.substring(lastDot).toLowerCase();
}

/**
 * Get file type category from extension
 */
function getFileType(filePath) {
  const ext = getFileExtension(filePath);
  return FILE_TYPE_CONFIG[ext] || {
    name: ext.substring(1).toUpperCase() || 'Otros',
    icon: 'fa-file',
    order: 999
  };
}

/**
 * Fetch models from Google Apps Script backend
 */
async function fetchModelsFromBackend() {
  try {
    // First try: look for existing models.json file locally
    const localResponse = await fetch(`./models.json?t=${Date.now()}`);
    
    if (localResponse.ok) {
      const localData = await localResponse.json();
      console.log(`[Enhanced Loader] Loaded ${localData.length} files from local models.json`);
      return localData;
    }
    
    // Fallback: Log warning about static models.json
    console.warn('[Enhanced Loader] models.json not found or empty. Using backend would require Google Apps Script configuration.');
    return [];
    
  } catch (error) {
    console.error(`[Enhanced Loader] Error fetching models: ${error}`);
    return [];
  }
}

/**
 * Toggle model visibility - connects to existing Pbe() function or fallback
 */
async function toggleModelVisibility(modelPath, modelName, listItem) {
  if (!listItem) return;
  
  const icon = listItem.querySelector('.visibility-toggle i');
  if (!icon) return;
  
  const isCurrentlyVisible = listItem.classList.contains('visible');
  
  if (isCurrentlyVisible) {
    // Hide model
    listItem.classList.remove('visible');
    icon.classList.replace('fa-eye', 'fa-eye-slash');
    
    // Also hide from loaded models map if available
    if (loadedModels.has(modelPath)) {
      const model = loadedModels.get(modelPath);
      if (model && model.object) {
        model.object.visible = false;
      }
    }
    console.log(`[Enhanced Loader] Hidden: ${modelName}`);
  } else {
    // Load and show model
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    try {
      // Try to use existing Pbe function or fallback
      if (typeof window.Pbe === 'function') {
        console.log(`[Enhanced Loader] Loading via Pbe(): ${modelName}`);
        await window.Pbe(modelPath, './', listItem);
      } else if (typeof window.loadModelFile === 'function') {
        console.log(`[Enhanced Loader] Loading via loadModelFile(): ${modelName}`);
        await window.loadModelFile(modelPath, modelName);
      } else {
        // Fallback: log that model loader is not available
        console.warn(`[Enhanced Loader] No loader available for: ${modelPath}`);
        alert('El cargador de modelos no está disponible. Recarga la página.');
        return;
      }
      
      listItem.classList.add('visible');
      icon.classList.replace('fa-eye-slash', 'fa-eye');
      console.log(`[Enhanced Loader] Loaded: ${modelName}`);
    } catch (error) {
      console.error(`[Enhanced Loader] Error loading model: ${error}`);
      icon.classList.replace('fa-eye', 'fa-eye-slash');
      listItem.classList.remove('visible');
      alert(`Error al cargar el modelo: ${error.message}`);
    } finally {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
  }
}

/**
 * Enhanced Model Loader - Groups files by type
 */
async function loadModelsEnhanced() {
  const modelListElement = document.getElementById('model-list');
  if (!modelListElement) {
    console.error('[Enhanced Loader] model-list element not found');
    return;
  }

  try {
    // Fetch models from backend or local file
    const modelsList = await fetchModelsFromBackend();
    
    if (!Array.isArray(modelsList)) {
      throw new Error('Models data must be an array');
    }

    console.log(`[Enhanced Loader] Loaded ${modelsList.length} files`);

    if (modelsList.length === 0) {
      modelListElement.innerHTML = '<div class="info-message">No models found</div>';
      return;
    }

    // Group files by type
    const groupedByType = {};
    
    modelsList.forEach(model => {
      if (!model || !model.path) return; // Skip invalid entries
      
      const fileType = getFileType(model.path);
      const typeKey = fileType.name; // Use friendly name as key
      
      if (!groupedByType[typeKey]) {
        groupedByType[typeKey] = {
          config: fileType,
          files: []
        };
      }
      groupedByType[typeKey].files.push(model);
    });

    // Sort type groups by order
    const sortedTypes = Object.entries(groupedByType)
      .sort((a, b) => a[1].config.order - b[1].config.order);

    if (sortedTypes.length === 0) {
      modelListElement.innerHTML = '<div class="info-message">No valid models found</div>';
      return;
    }

    // Clear and rebuild HTML
    modelListElement.innerHTML = '';

    // Create type groups
    sortedTypes.forEach(([typeName, typeData]) => {
      const { config, files } = typeData;
      
      // Create file type group container
      const folderGroup = document.createElement('div');
      folderGroup.className = 'file-type-group';
      folderGroup.dataset.typeCount = files.length;
      
      // Create header with icon and title
      const header = document.createElement('div');
      header.className = 'file-type-header';
      header.innerHTML = `
        <span class="type-label">
          <i class="fa-solid ${config.icon}"></i> 
          <span>${typeName}</span>
          <span class="file-count">${files.length}</span>
        </span> 
        <i class="fa-solid fa-chevron-down toggle-icon"></i>
      `;
      header.style.cursor = 'pointer';
      
      // Create files list
      const filesList = document.createElement('ul');
      filesList.className = 'file-type-items';
      
      // Sort files alphabetically by name
      files.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      files.forEach(file => {
        if (!file || !file.path) return; // Skip invalid entries
        
        const listItem = document.createElement('li');
        listItem.className = 'model-item';
        listItem.dataset.path = file.path;
        
        const displayName = file.name || file.path.split('/').pop() || 'Untitled';
        
        listItem.innerHTML = `
          <div class="model-name">
            <i class="fa-solid ${config.icon} file-icon"></i> 
            <span class="name-text" title="${displayName}">${displayName}</span>
          </div>
          <div class="visibility-toggle" title="Toggle Visibility">
            <i class="fa-regular fa-eye-slash"></i>
          </div>
        `;
        
        // Add click handler for loading model
        listItem.addEventListener('click', async (e) => {
          e.stopPropagation();
          await toggleModelVisibility(file.path, displayName, listItem);
        });
        
        filesList.appendChild(listItem);
      });
      
      // Add click handler for header to toggle visibility of files
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        filesList.classList.toggle('collapsed');
        const chevron = header.querySelector('.toggle-icon');
        if (chevron) chevron.classList.toggle('collapsed');
      });
      
      folderGroup.appendChild(header);
      folderGroup.appendChild(filesList);
      modelListElement.appendChild(folderGroup);
    });

    console.log(`[Enhanced Loader] Successfully organized ${sortedTypes.length} file type categories`);

  } catch (error) {
    console.error(`[Enhanced Loader] Fatal error: ${error}`);
    modelListElement.innerHTML = `<div class="error-message">❌ Error: ${error.message}</div>`;
  }
}

/**
 * Add CSS for enhanced file type groups
 */
function injectStyles() {
  // Check if already injected
  if (document.getElementById('enhanced-loader-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'enhanced-loader-styles';
  style.textContent = `
    .file-type-group {
      margin-bottom: 1px;
      border-bottom: 1px solid #e0e0e0;
    }

    .file-type-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 15px;
      background: linear-gradient(135deg, #f5f5f5 0%, #efefef 100%);
      user-select: none;
      transition: all 0.2s ease;
      font-weight: 600;
      color: #333;
    }

    .file-type-header:hover {
      background: linear-gradient(135deg, #ececec 0%, #e0e0e0 100%);
      padding-left: 18px;
    }

    .type-label {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .file-type-header .toggle-icon {
      font-size: 14px;
      transition: transform 0.3s ease;
      flex-shrink: 0;
    }

    .file-type-header .toggle-icon.collapsed {
      transform: rotate(-90deg);
    }

    .file-count {
      font-size: 12px;
      background: #007bff;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: normal;
      margin-left: 5px;
      display: inline-block;
    }

    .file-type-items {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 1000px;
      overflow: hidden;
      transition: max-height 0.3s ease, opacity 0.3s ease;
      opacity: 1;
    }

    .file-type-items.collapsed {
      max-height: 0;
      opacity: 0;
    }

    .model-item {
      padding: 10px 15px 10px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.15s ease;
      cursor: pointer;
    }

    .model-item:hover {
      background: #f9f9f9;
      padding-left: 43px;
    }

    .model-item.visible {
      background: #e8f5e9;
    }

    .model-name {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      color: #555;
      font-size: 14px;
      min-width: 0;
    }

    .file-icon {
      font-size: 12px;
      color: #007bff;
      flex-shrink: 0;
    }

    .name-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .visibility-toggle {
      cursor: pointer;
      padding: 5px 8px;
      border-radius: 4px;
      transition: all 0.15s ease;
      color: #999;
      flex-shrink: 0;
      margin-left: 8px;
    }

    .visibility-toggle:hover {
      background: #e0e0e0;
      color: #333;
    }

    .model-item.visible .visibility-toggle {
      color: #28a745;
    }

    .error-message {
      padding: 20px;
      color: #d32f2f;
      text-align: center;
      font-size: 13px;
      background: #ffebee;
      border-radius: 4px;
      margin: 10px;
    }

    .info-message {
      padding: 20px;
      color: #1976d2;
      text-align: center;
      font-size: 13px;
      background: #e3f2fd;
      border-radius: 4px;
      margin: 10px;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Initialize when DOM is ready
 */
function initEnhancedLoader() {
  injectStyles();
  loadModelsEnhanced();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEnhancedLoader);
} else {
  // DOM already loaded
  initEnhancedLoader();
}

// Export for manual calls or debugging
window.loadModelsEnhanced = loadModelsEnhanced;
window.toggleModelVisibility = toggleModelVisibility;
window.getFileType = getFileType;

console.log('[Enhanced Loader] Initialized and ready');
