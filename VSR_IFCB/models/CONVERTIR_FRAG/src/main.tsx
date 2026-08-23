import { IfcImporter } from '@thatopen/fragments';

// Use unpkg for WASM - works cross-origin without local server
const WEB_IFC_WASM = 'https://unpkg.com/web-ifc@0.0.77/';

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + step)));
  }
  return btoa(binary);
}

async function doConvert(bytes: Uint8Array, filename: string) {
  const imp = new IfcImporter();
  imp.wasm = { path: WEB_IFC_WASM, absolute: true };
  const frag = await imp.process({ bytes });
  return {
    fragBase64: uint8ToBase64(frag),
    jsonBase64: btoa('{}'),
    baseName: filename.replace(/\.ifc$/i, ''),
  };
}

// postMessage API: accepts CONVERT_IFC, returns CONVERT_RESULT or CONVERT_ERROR
window.addEventListener('message', async (e) => {
  if (e.data?.type !== 'CONVERT_IFC') return;
  const { bytes, filename, requestId } = e.data;
  try {
    const result = await doConvert(new Uint8Array(bytes as ArrayBuffer), String(filename));
    (e.source as Window)?.postMessage({ type: 'CONVERT_RESULT', requestId, ...result }, '*' as any);
  } catch (err: any) {
    (e.source as Window)?.postMessage({ type: 'CONVERT_ERROR', requestId, error: String(err?.message || err) }, '*' as any);
  }
});

// Signal ready to parent frame
if (window.parent !== window) {
  window.parent.postMessage({ type: 'CONVERTER_READY' }, '*');
}
