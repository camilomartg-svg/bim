/**
 * audioRecorderUtils.ts
 * Utilidad robusta para grabar audio en navegadores de escritorio y celulares (Android / iOS).
 * Retorna un File / Blob compatible para subir a Google Drive e insertar en la app.
 */

export interface AudioRecordingResult {
  blob: Blob;
  file: File;
  url: string;
  durationSeconds: number;
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;

  public async start(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Tu navegador o dispositivo no soporta grabación de audio.');
    }

    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Determinar mimeType soportado por el navegador/celular
    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4'; // Safari iOS
    } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      mimeType = 'audio/ogg;codecs=opus';
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    } catch (_) {
      this.mediaRecorder = new MediaRecorder(this.stream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(250); // Recolectar trozos cada 250ms
  }

  public async stop(): Promise<AudioRecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('No hay grabación activa'));
      }

      const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const isMp4 = mimeType.includes('mp4');
        const ext = isMp4 ? '.m4a' : '.webm';
        const finalBlob = new Blob(this.audioChunks, { type: mimeType });
        const fileName = `Audio_Nota_${Date.now()}${ext}`;
        const file = new File([finalBlob], fileName, { type: mimeType });
        const url = URL.createObjectURL(finalBlob);

        // Detener pistas de audio para apagar el indicador de micrófono del celular
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];

        resolve({
          blob: finalBlob,
          file,
          url,
          durationSeconds
        });
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        reject(new Error('Grabador inactivo'));
      }
    });
  }

  public cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
