/**
 * Generate models.json dynamically from Google Apps Script
 * 
 * This script fetches all 3D file types from the Google Apps Script backend
 * and generates a complete models.json file.
 * 
 * Usage:
 *  1. Configure GAS_ENDPOINT with your Google Apps Script deployment URL
 *  2. Run this script to generate models.json
 *  3. Copy the output to your models.json file
 */

const GAS_ENDPOINT = 'https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercallback';

/**
 * Fetch all models from Google Apps Script
 */
async function generateModelsJson() {
  console.log('Starting models.json generation...');
  
  try {
    // Build request to Google Apps Script
    const requestBody = {
      action: 'list',
      folderId: '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H', // Root folder ID
      project: 'Auto', // or your project slug
      driveFolderName: '' // or your Drive folder name
    };
    
    console.log('Sending request to:', GAS_ENDPOINT);
    console.log('Request body:', requestBody);
    
    const response = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Backend response:', data);
    
    if (!data.allModels) {
      console.warn('No allModels in response. Available keys:', Object.keys(data));
      if (data.models) {
        console.log('Using legacy "models" array instead');
        data.allModels = data.models;
      } else {
        throw new Error('No models found in backend response');
      }
    }
    
    // Format for models.json
    const modelsJson = data.allModels.map(m => ({
      name: m.name,
      path: m.path || m.fileId,
      folder: m.folder || 'Auto',
      extension: m.extension
    }));
    
    console.log(`Generated ${modelsJson.length} models`);
    console.log('Output (copy this to models.json):');
    console.log(JSON.stringify(modelsJson, null, 2));
    
    // Also save to file
    const blob = new Blob([JSON.stringify(modelsJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'models.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return modelsJson;
    
  } catch (error) {
    console.error('Error generating models.json:', error);
    throw error;
  }
}

// Run if in browser console
if (typeof window !== 'undefined') {
  window.generateModelsJson = generateModelsJson;
  console.log('generateModelsJson() is ready. Call it to generate models.json');
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateModelsJson };
}
