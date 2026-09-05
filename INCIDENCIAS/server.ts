import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Crucial: Increase body-parser limits for base64 payloads (necessary for images/media uploads)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API upload route that proxies to Google Apps Script Web App securely and bypasses CORS
  app.post("/api/upload-to-drive", async (req, res) => {
    try {
      const { base64, mimeType, name, folderId } = req.body;
      if (!base64 || !name) {
        return res.status(400).json({ status: "error", message: "Faltan parámetros requeridos: base64 o name." });
      }

      console.log(`[Server Proxy] Forwarding upload to Google Apps Script Gateway: ${name} (${mimeType})`);

      const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec";

      // Server-to-server fetch request has no CORS, iframe blocks, or third-party cookie restrictions
      const googleResponse = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: "uploadFile",
          content: base64,
          contentType: mimeType || "image/jpeg",
          filename: name,
          folderId: folderId
        })
      });

      if (!googleResponse.ok) {
        throw new Error(`Google Apps Script Gateway respondió con estado ${googleResponse.status}`);
      }

      const payload = await googleResponse.json();
      console.log(`[Server Proxy] Apps Script response:`, payload);
      res.json(payload);
    } catch (err: any) {
      console.error("[Server Proxy] Error uploading file via Apps Script:", err);
      res.status(500).json({ status: "error", message: err.message || String(err) });
    }
  });

  // Securely proxy images directly from Google Drive using the File ID to completely bypass all Iframe, third-party cookies, and CORS restrictions
  app.get("/api/drive-image/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const token = req.query.token as string || "";

      if (!fileId) {
        return res.status(400).send("Se requiere el ID de archivo de Google Drive.");
      }

      console.log(`[Server Proxy] Fetching Google Drive image with ID: ${fileId}. Token present: ${!!token}`);

      let driveRes: Response | null = null;

      // 1. If we have a token, attempt the official Google Drive API to fetch private images
      if (token) {
        try {
          const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (response.ok) {
            driveRes = response;
            console.log(`[Server Proxy] Successfully fetched image via Google Drive API with token.`);
          } else {
            console.warn(`[Server Proxy] Authenticated Google Drive API download returned status: ${response.status}`);
          }
        } catch (apiErr) {
          console.warn(`[Server Proxy] Error calling Google Drive API with token:`, apiErr);
        }
      }

      // 2. Fall back to standard public visual/thumbnail endpoints if no token or official download failed
      if (!driveRes) {
        const endpoints = [
          `https://lh3.googleusercontent.com/d/${fileId}`,
          `https://drive.google.com/uc?id=${fileId}&export=download`,
          `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
        ];

        for (const url of endpoints) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              driveRes = response;
              console.log(`[Server Proxy] Successfully fetched image via public link: ${url}`);
              break;
            }
          } catch (fetchErr) {
            console.warn(`[Server Proxy] Failed to fetch from drive URL: ${url}`, fetchErr);
          }
        }
      }

      if (!driveRes) {
        throw new Error("No se pudo obtener la imagen desde los servidores de Google Drive.");
      }

      // Serve the content with optimized headers
      const contentType = driveRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=172800"); // Cache in browser for 2 days for superb performance

      const arrayBuffer = await driveRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("[Server Proxy] Error proxying Google Drive image:", err);
      // Fallback placeholder image or 404
      res.status(500).send("Error obteniendo la imagen de Google Drive.");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
