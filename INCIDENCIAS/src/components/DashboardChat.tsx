import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Issue, Comment, Attachment } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Send, Paperclip, Image as ImageIcon, Video, Mic, 
  FilePlus, MessageSquare, User, MoreVertical, X, 
  CheckCircle2, Clock, ThumbsUp, ThumbsDown, AlertCircle, AlertTriangle,
  ChevronDown, ChevronUp, Maximize2, Layers, Camera, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, isPast } from 'date-fns';
import { 
  getCloseDate, 
  getMedicionDueDate, 
  getEficaciaDueDate, 
  isMedicionAlertActive, 
  isEficaciaAlertActive, 
  isAuthorizedForQualityFollowUp,
  generateFollowUpCode
} from '../utils/followUpUtils';
import { uploadFileToDrive } from '../utils/googleDriveUtils';

const RCD_MATERIALS = [
  { material: "Acero", density: 7800 },
  { material: "Baldosa cerámica", density: 2400 },
  { material: "Cemento pórtland, a granel", density: 1440 },
  { material: "Concreto simple", density: 2300 },
  { material: "Concreto reforzado", density: 2400 },
  { material: "Hierro (Fundido)", density: 7200 },
  { material: "Hierro (Forjado)", density: 7700 },
  { material: "Madera laminada", density: 600 },
  { material: "Mampostería de concreto", density: 2150 },
  { material: "Mampostería de ladrillo macizo", density: 1850 },
  { material: "Mampostería de piedra", density: 2200 },
  { material: "Mortero de inyección para mampostería", density: 2250 },
  { material: "Mortero de pega para mampostería", density: 2100 },
  { material: "Piedra (Caliza, mármol, cuarzo)", density: 2700 },
  { material: "Piedra (Basalto, granito, gneis)", density: 2850 },
  { material: "Piedra (Arenisca)", density: 2200 },
  { material: "Piedra (Pizarra)", density: 2605 }
];

interface DashboardChatProps {
  selectedIssue: Issue | null;
}

export default function DashboardChat({ selectedIssue }: DashboardChatProps) {
  const [messages, setMessages] = useState<Comment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, googleAccessToken } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localIssue, setLocalIssue] = useState<Issue | null>(selectedIssue);

  useEffect(() => {
    setLocalIssue(selectedIssue);
    if (!selectedIssue) return;

    const unsubIssue = onSnapshot(doc(db, 'issues', selectedIssue.id), (docSnap) => {
      if (docSnap.exists()) {
        setLocalIssue({ id: docSnap.id, ...docSnap.data() } as Issue);
      }
    });

    return () => {
      unsubIssue();
    };
  }, [selectedIssue?.id]);

  const activeIssue = localIssue || selectedIssue;
  const isAprovechamientoIssue = activeIssue?.id?.startsWith('issue_e_apr_') || activeIssue?.code?.includes('AMB-APR') || activeIssue?.title?.toUpperCase().includes('APROVECHAMIENTO');

  // Stockpile cubicación response form states inside chat
  const [showAcopioForm, setShowAcopioForm] = useState(false);
  const [acopioLargo, setAcopioLargo] = useState<number | ''>('');
  const [acopioAncho, setAcopioAncho] = useState<number | ''>('');
  const [acopioFondo, setAcopioFondo] = useState<number | ''>('');
  const [acopioDuracion, setAcopioDuracion] = useState<number | ''>('');

  // Specific states for environmental RCD Aprovechamiento responses
  const duranteFileInputRef = useRef<HTMLInputElement>(null);
  const finalFileInputRef = useRef<HTMLInputElement>(null);
  const [mediaDuring, setMediaDuring] = useState<any[]>([]);
  const [mediaFinal, setMediaFinal] = useState<any[]>([]);
  const [isUploadingDuring, setIsUploadingDuring] = useState(false);
  const [isUploadingFinal, setIsUploadingFinal] = useState(false);
  const [materialSelect, setMaterialSelect] = useState('Concreto simple');
  const [materialDensity, setMaterialDensity] = useState(2300);

  // Direct Live Camera state hooks inside Chat
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraRecording, setIsCameraRecording] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'during' | 'final' | 'chat'>('chat');
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [mediaRecorderRef, setMediaRecorderRef] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  const dataURLtoBlob = (dataurl: string): Blob => {
    try {
      const arr = dataurl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error("Error converting data URL to Blob:", e);
      return new Blob([], { type: 'image/jpeg' });
    }
  };

  const startCamera = async (target: 'during' | 'final' | 'chat' = 'chat', deviceId?: string) => {
    setCameraTarget(target);
    setCameraError(null);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = allDevices.filter(d => d.kind === 'videoinput');
      setCameraDevices(videoIn);
      if (!selectedCameraId && videoIn.length > 0) {
        setSelectedCameraId(deviceId || videoIn[0].deviceId);
      }
    } catch (err: any) {
      console.warn("Could not start real hardware camera stream in Chat:", err);
      setCameraError(
        err.message || 
        "No se pudo acceder a la cámara de manera directa en este explorador/entorno. Usando simulador de captura asistida de alta fidelidad."
      );
      setIsCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setIsCameraRecording(false);
    if (mediaRecorderRef) {
      try {
        mediaRecorderRef.stop();
      } catch (e) {}
      setMediaRecorderRef(null);
    }
    setRecordedChunks([]);
  };

  const addCapturedMediaFile = (file: { name: string; url: string; type: 'image' | 'video' }) => {
    const attachment = {
      id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
      name: file.name,
      type: file.type === 'video' ? 'video/webm' : 'image/jpeg',
      url: file.url,
      category: file.type as any
    };

    if (cameraTarget === 'during') {
      handleCapturedDuringSync(attachment);
    } else if (cameraTarget === 'final') {
      setMediaFinal(prev => [...prev, attachment]);
    } else {
      handleDirectChatAttachment(attachment);
    }
  };

  const handleCapturedDuringSync = async (attachment: any) => {
    if (!user || !activeIssue) return;
    
    const adminCommentText = `📸 **[REGISTRO FOTOGRÁFICO/VIDEO DURANTE LA REUTILIZACIÓN]**

Se ha registrado una nueva evidencia en tiempo real (Foto/Video) tomada durante el proceso de aprovechamiento en obra:
• **Archivo**: ${attachment.name}`;

    try {
      await addDoc(collection(db, 'issues', activeIssue.id, 'comments'), {
        userId: user.id,
        userName: user.name,
        text: adminCommentText,
        createdAt: new Date().toISOString(),
        userAvatar: user.name.charAt(0),
        attachments: [{ ...attachment, name: `DURANTE: ${attachment.name}` }]
      });

      await updateDoc(doc(db, 'issues', activeIssue.id), {
        lastComment: adminCommentText,
        lastCommentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const reportId = activeIssue.sourceReportId || (activeIssue.id.startsWith('issue_e_apr_') ? activeIssue.id.replace('issue_e_apr_', '') : null);
      if (reportId) {
        const reportRef = doc(db, 'reports', reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) {
          const reportData = reportSnap.data();
          const existingMediaDuring = reportData.mediaDuring || [];
          await updateDoc(reportRef, {
            mediaDuring: [...existingMediaDuring, attachment],
            updatedAt: new Date().toISOString()
          });
        }
      }
      setMediaDuring(prev => [...prev, attachment]);
    } catch (e) {
      console.error("Error syncing captured during file:", e);
    }
  };

  const handleDirectChatAttachment = async (attachment: any) => {
    if (!user || !activeIssue) return;
    try {
      await addDoc(collection(db, 'issues', activeIssue.id, 'comments'), {
        userId: user.id,
        userName: user.name,
        text: `Ha capturado un recurso multimedia usando la cámara: ${attachment.name}`,
        createdAt: new Date().toISOString(),
        userAvatar: user.name.charAt(0),
        attachments: [attachment]
      });

      await updateDoc(doc(db, 'issues', activeIssue.id), {
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error creating comment for captured attachment:", e);
    }
  };

  const capturePhotoFromCamera = (videoEl: HTMLVideoElement | null) => {
    if (videoEl && cameraStream) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 640;
        canvas.height = videoEl.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg');
          const fileName = `CAM_FOTO_${Date.now().toString().slice(-6)}.jpg`;
          
          addCapturedMediaFile({
            name: fileName,
            url: dataUrl,
            type: 'image'
          });
          
          stopCamera();
          return;
        }
      } catch (err) {
        console.error("Failed to capture from canvas in chat", err);
      }
    }

    const mockImages = [
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600',
      'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=600'
    ];
    const chosen = mockImages[Math.floor(Math.random() * mockImages.length)];
    const fileName = `SIM_CAM_FOTO_${Date.now().toString().slice(-4)}.jpg`;
    addCapturedMediaFile({
      name: fileName,
      url: chosen,
      type: 'image'
    });
    stopCamera();
  };

  const startVideoRecordingFromCamera = () => {
    if (!cameraStream) {
      setIsCameraRecording(true);
      return;
    }

    try {
      setRecordedChunks([]);
      const options = { mimeType: 'video/webm;codecs=vp9' };
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(cameraStream, options);
      } catch (e) {
        rec = new MediaRecorder(cameraStream);
      }

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          setRecordedChunks(prev => [...prev, e.data]);
        }
      };

      rec.onstop = () => {
        setTimeout(async () => {
          setRecordedChunks(currentChunks => {
            if (currentChunks.length === 0) return [];
            const blob = new Blob(currentChunks, { type: 'video/webm' });
            
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              const fileName = `CAM_VIDEO_${Date.now().toString().slice(-6)}.webm`;
              addCapturedMediaFile({
                name: fileName,
                url: base64data,
                type: 'video'
              });
            };
            reader.readAsDataURL(blob);
            return [];
          });
        }, 100);
      };

      rec.start(1000);
      setMediaRecorderRef(rec);
      setIsCameraRecording(true);
    } catch (err) {
      console.error("Failed to start MediaRecorder in chat, fallback to simulation", err);
      setIsCameraRecording(true);
    }
  };

  const stopVideoRecordingFromCamera = () => {
    if (mediaRecorderRef && isCameraRecording) {
      try {
        mediaRecorderRef.stop();
      } catch (e) {
        console.error("Error stopping media recorder:", e);
      }
      setMediaRecorderRef(null);
      setIsCameraRecording(false);
      stopCamera();
    } else {
      setIsCameraRecording(false);
      const fileName = `SIM_CAM_VIDEO_${Date.now().toString().slice(-4)}.mp4`;
      addCapturedMediaFile({
        name: fileName,
        url: 'https://assets.mixkit.co/videos/preview/mixkit-dusty-road-on-a-sunny-day-4384-large.mp4',
        type: 'video'
      });
      stopCamera();
    }
  };

  const handleSpecificUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'during' | 'final') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user || !activeIssue) return;
    
    if (target === 'during') setIsUploadingDuring(true);
    else setIsUploadingFinal(true);

    try {
      const file = files[0];
      const category = file.type.startsWith('image/') ? 'image' : 
                       file.type.startsWith('video/') ? 'video' : 'file';

      // 1. Prepare Base64 as a quick and reliable fallback
      const base64UrlPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      let url = "";
      let driveFileId = "";
      let webViewLink = "";
      let uploadSuccess = false;

      const gToken = googleAccessToken || localStorage.getItem('google_drive_token');
      if (gToken) {
        try {
          console.log("Attempting direct upload to Google Drive first for file:", file.name);
          const driveResult = await uploadFileToDrive(file, file.name, file.type, '1Bym51TtKVSzDsweJaMAh0VxCAAQQbU3w', gToken);
          url = driveResult.url;
          driveFileId = driveResult.id;
          webViewLink = driveResult.webViewLink;
          uploadSuccess = true;
          console.log("Google Drive upload successful:", driveResult);
        } catch (driveErr) {
          console.warn("Google Drive upload failed inside specific chat upload, falling back to Firebase/Base64:", driveErr);
        }
      }

      if (!uploadSuccess) {
        try {
          // Try uploading to Firebase Storage with a 4 second timeout fallback
          const uploadPromise = async () => {
            const storageRef = ref(storage, `issues/${activeIssue.id}/${Date.now()}_${target}_${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            return await getDownloadURL(uploadResult.ref);
          };

          const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Firebase Storage took too long. Falling back to local/Base64 channel.")), 4000)
          );

          url = await Promise.race([uploadPromise(), timeoutPromise]);
        } catch (uploadErr) {
          console.warn("Storage upload took fallback route to Base64:", uploadErr);
          url = await base64UrlPromise;
        }
      }

      const attachment = {
        id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
        name: file.name,
        type: file.type,
        url,
        category: category as any,
        ...(driveFileId ? { driveFileId } : {}),
        ...(webViewLink ? { webViewLink } : {})
      };

      if (target === 'during') {
        const adminCommentText = `📸 **[REGISTRO DE EVIDENCIA DURANTE LA REUTILIZACIÓN]**
121: 

Se ha registrado una nueva evidencia tomada durante el proceso de aprovechamiento/reutilización en obra:
• **Archivo**: ${file.name}${driveFileId ? ' (Guardado directamente en Google Drive)' : ''}`;

        await addDoc(collection(db, 'issues', activeIssue.id, 'comments'), {
          userId: user.id,
          userName: user.name,
          text: adminCommentText,
          createdAt: new Date().toISOString(),
          userAvatar: user.name.charAt(0),
          attachments: [{ ...attachment, name: `DURANTE: ${attachment.name}` }]
        });

        await updateDoc(doc(db, 'issues', activeIssue.id), {
          lastComment: adminCommentText,
          lastCommentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Sync directly to the report document
        const reportId = activeIssue.sourceReportId || (activeIssue.id.startsWith('issue_e_apr_') ? activeIssue.id.replace('issue_e_apr_', '') : null);
        if (reportId) {
          const reportRef = doc(db, 'reports', reportId);
          const reportSnap = await getDoc(reportRef);
          if (reportSnap.exists()) {
            const reportData = reportSnap.data();
            const existingMediaDuring = reportData.mediaDuring || [];
            await updateDoc(reportRef, {
              mediaDuring: [...existingMediaDuring, attachment],
              updatedAt: new Date().toISOString()
            });
            console.log("Uploaded during image immediately synced back to reports:", reportId);
          }
        }

        setMediaDuring(prev => [...prev, attachment]);
      } else {
        // Sync final photo directly to parent report too
        const reportId = activeIssue.sourceReportId || (activeIssue.id.startsWith('issue_e_apr_') ? activeIssue.id.replace('issue_e_apr_', '') : null);
        if (reportId) {
          try {
            const reportRef = doc(db, 'reports', reportId);
            const reportSnap = await getDoc(reportRef);
            if (reportSnap.exists()) {
              const reportData = reportSnap.data();
              const existingMediaFinal = reportData.mediaFinal || [];
              await updateDoc(reportRef, {
                mediaFinal: [...existingMediaFinal, attachment],
                updatedAt: new Date().toISOString()
              });
              console.log("Uploaded final image immediately synced back to parent environmental report:", reportId);
            }
          } catch (syncErr) {
            console.error("Error syncing final image to parent report:", syncErr);
          }
        }
        setMediaFinal(prev => [...prev, attachment]);
      }
    } catch (err) {
      console.error(`Error uploading specific image for ${target}:`, err);
    } finally {
      setIsUploadingDuring(false);
      setIsUploadingFinal(false);
    }
  };

  // Quality Report Follow-Up interactive states
  const [isFollowUpCollapsed, setIsFollowUpCollapsed] = useState(true);
  const [showFollowUpForm, setShowFollowUpForm] = useState<"medicion" | "eficacia" | "extraordinaria" | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpValoration, setFollowUpValoration] = useState<'EFICAZ' | 'NO_EFICAZ'>('EFICAZ');

  const handleSaveFollowUp = async (type: "medicion" | "eficacia" | "extraordinaria") => {
    if (!user || !activeIssue) return;
    if (!followUpNotes.trim()) {
      alert("Por favor ingrese las notas y sustentación del seguimiento técnico.");
      return;
    }

    try {
      const isMedicion = type === "medicion";
      const isEficacia = type === "eficacia";
      const isExtraordinaria = type === "extraordinaria";

      let reviewCode = "";
      let consecutive = 1;

      if (isMedicion) {
        consecutive = 1;
        reviewCode = generateFollowUpCode(activeIssue, consecutive);
      } else if (isEficacia) {
        consecutive = 2;
        reviewCode = generateFollowUpCode(activeIssue, consecutive);
      } else if (isExtraordinaria) {
        consecutive = 3 + (activeIssue.extraordinarias?.length || 0);
        reviewCode = generateFollowUpCode(activeIssue, consecutive);
      }

      const followUpData: any = {
        code: reviewCode,
        completed: true,
        completedAt: new Date().toISOString(),
        completedBy: user.id,
        completedByName: user.name,
        valoration: followUpValoration,
        notes: followUpNotes
      };

      const updatePayload: any = {};
      if (isMedicion) {
        const calculatedDueDate = getMedicionDueDate(activeIssue);
        updatePayload.medicionInicial = {
          ...followUpData,
          dueDate: calculatedDueDate ? calculatedDueDate.toISOString().split('T')[0] : ''
        };
      } else if (isEficacia) {
        const calculatedDueDate = getEficaciaDueDate(activeIssue);
        updatePayload.revisionEficacia = {
          ...followUpData,
          dueDate: calculatedDueDate ? calculatedDueDate.toISOString().split('T')[0] : ''
        };
      } else if (isExtraordinaria) {
        const existingExtra = activeIssue.extraordinarias || [];
        updatePayload.extraordinarias = [
          ...existingExtra,
          {
            code: reviewCode,
            consecutive,
            completedAt: new Date().toISOString(),
            completedBy: user.id,
            completedByName: user.name,
            valoration: followUpValoration,
            notes: followUpNotes
          }
        ];
      }

      await updateDoc(doc(db, 'issues', activeIssue.id), {
        ...updatePayload,
        updatedAt: new Date().toISOString()
      });

      let reviewLabel = "";
      if (isMedicion) {
        reviewLabel = `MEDICIÓN INICIAL (1 Mes) [CÓDIGO: ${reviewCode}]`;
      } else if (isEficacia) {
        reviewLabel = `REVISIÓN EFICACIA (3 Meses) [CÓDIGO: ${reviewCode}]`;
      } else if (isExtraordinaria) {
        reviewLabel = `MEDICIÓN EXTRAORDINARIA (${consecutive}) [CÓDIGO: ${reviewCode}]`;
      }

      const systemLogMessage = `📋 **[SEGUIMIENTO DE CONTROL DE CALIDAD]**
• **Código**: ${reviewCode}
• **Tipo**: ${reviewLabel}
• **Estado**: COMPLETADO ✅
• **Fecha de Registro**: ${format(new Date(), 'dd/MM/yyyy HH:mm')}
• **Valoración**: ${followUpValoration === 'EFICAZ' ? '🟢 EFICAZ' : '🔴 NO EFICAZ'}
• **Registrado por**: ${user.name} (${user.position || 'Calidad'})
• **Conclusiones / Notas de Seguimiento**: ${followUpNotes}`;

      await addDoc(collection(db, 'issues', activeIssue.id, 'comments'), {
        userId: user.id,
        userName: 'SISTEMA DE CALIDAD',
        text: systemLogMessage,
        createdAt: new Date().toISOString(),
        userAvatar: '⚙️'
      });

      setShowFollowUpForm(null);
      setFollowUpNotes('');
      setFollowUpValoration('EFICAZ');

    } catch (err) {
      console.error("Failed to save follow up review:", err);
    }
  };

  useEffect(() => {
    if (!selectedIssue) return;

    setLoading(true);
    const q = query(collection(db, 'issues', selectedIssue.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setMessages(messagesData);
      setLoading(false);
      // Auto scroll
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }, (error) => {
      console.error("Chat snapshot error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [selectedIssue?.id]);

  const getEffectiveStatus = (issue: Issue): string => {
    if (issue.status === 'ACUERDO') return 'ACUERDO';
    if (issue.status === 'RESUELTA') return 'RESUELTA';
    if (issue.status === 'RESPONDIDA') return 'RESPONDIDA';
    if (issue.status === 'RECHAZADA') return 'RECHAZADA';
    if (issue.status === 'ANULADA') return 'ANULADA';
    
    if (issue.dueDate) {
      const dueDate = new Date(issue.dueDate + 'T23:59:59');
      if (isPast(dueDate)) return 'VENCIDA';
    }
    return issue.status || 'ACTIVO';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const textTrimmed = newMessage.trim();
    const hasGeneralForm = !isAprovechamientoIssue && showAcopioForm && acopioLargo !== '' && acopioAncho !== '' && acopioFondo !== '';
    const hasAprovechamientoForm = isAprovechamientoIssue && showAcopioForm && acopioLargo !== '' && acopioAncho !== '' && acopioFondo !== '';
    const hasForm = hasGeneralForm || hasAprovechamientoForm;
    
    if (!textTrimmed && !hasForm) return;
    if (!user || !activeIssue) return;

    let messageText = textTrimmed;
    let commentAttachments: any[] = [];

    try {
      if (hasForm) {
        const numLargo = Number(acopioLargo) || 0;
        const numAncho = Number(acopioAncho) || 0;
        const numFondo = Number(acopioFondo) || 0;
        const numDuracion = Number(acopioDuracion) || 0;
        const calArea = numLargo * numAncho;
        const calVolumen = numLargo * numAncho * numFondo;
        if (isAprovechamientoIssue) {
          const calPesoKg = calVolumen * materialDensity;

          // Sync directly to the report document first
          const reportId = activeIssue.sourceReportId || (activeIssue.id.startsWith('issue_e_apr_') ? activeIssue.id.replace('issue_e_apr_', '') : null);
          let cumulativePayload = {
            acopioLargo: numLargo,
            acopioAncho: numAncho,
            acopioAlto: numFondo,
            acopioDuracionProceso: numDuracion,
            acopioVolumen: calVolumen,
            acopioAreaRecuperada: calArea,
            materialSNR: materialSelect,
            densidadSNR: materialDensity,
            updatedAt: new Date().toISOString()
          };

          if (reportId) {
            try {
              const reportRef = doc(db, 'reports', reportId);
              const reportSnap = await getDoc(reportRef);
              if (reportSnap.exists()) {
                const reportData = reportSnap.data();
                const existingLogs = reportData.logs || [];
                const existingMediaDuring = reportData.mediaDuring || [];
                const existingMediaFinal = reportData.mediaFinal || [];

                // Create the new log entry
                const newLog = {
                  id: 'log-' + Math.random().toString(36).substr(2, 9),
                  material: 'PETREOS',
                  quantity: calPesoKg,
                  unit: 'KG',
                  recipient: 'OBRA (REUTILIZACIÓN AUTÓCTONA)',
                  certificateCode: 'AUT-RCD',
                  date: new Date().toISOString().split('T')[0],
                  observations: textTrimmed || 'Reutilización autónoma SNR-15.',
                  status: 'APROVECHADO',
                  largo: numLargo,
                  ancho: numAncho,
                  alto: numFondo,
                  duracionProceso: numDuracion,
                  volumenReutilizado: calVolumen,
                  areaRecuperada: calArea,
                  materialSNR: materialSelect,
                  densidadSNR: materialDensity
                };

                const updatedLogs = [...existingLogs, newLog];

                // Deduplicate media elements based on url to prevent double-write from instant camera/during uploads
                const duringMediaMap = new Map();
                [...existingMediaDuring, ...mediaDuring].forEach((item: any) => {
                  if (item && item.url) {
                    duringMediaMap.set(item.url, item);
                  }
                });
                const updatedMediaDuring = Array.from(duringMediaMap.values());

                const finalMediaMap = new Map();
                [...existingMediaFinal, ...mediaFinal].forEach((item: any) => {
                  if (item && item.url) {
                    finalMediaMap.set(item.url, item);
                  }
                });
                const updatedMediaFinal = Array.from(finalMediaMap.values());

                // Calculate cumulative values across all logs
                let totalVolumen = 0;
                let totalArea = 0;
                let maxLargo = 0;
                let maxAncho = 0;
                let maxAlto = 0;
                let maxDuracion = 30;

                updatedLogs.forEach((log: any) => {
                  totalVolumen += Number(log.volumenReutilizado) || 0;
                  totalArea += Number(log.areaRecuperada) || 0;
                  if (Number(log.largo) > maxLargo) maxLargo = Number(log.largo);
                  if (Number(log.ancho) > maxAncho) maxAncho = Number(log.ancho);
                  const logAlto = log.alto !== undefined ? log.alto : log.fondo;
                  if (Number(logAlto) > maxAlto) maxAlto = Number(logAlto);
                  if (Number(log.duracionProceso) > maxDuracion || maxDuracion === 30) {
                    maxDuracion = Number(log.duracionProceso);
                  }
                });

                await updateDoc(reportRef, {
                  logs: updatedLogs,
                  mediaDuring: updatedMediaDuring,
                  mediaFinal: updatedMediaFinal,
                  updatedAt: new Date().toISOString()
                });

                // Update cumulative payload for the issue
                cumulativePayload = {
                  acopioLargo: maxLargo,
                  acopioAncho: maxAncho,
                  acopioAlto: maxAlto,
                  acopioDuracionProceso: maxDuracion,
                  acopioVolumen: totalVolumen,
                  acopioAreaRecuperada: totalArea,
                  materialSNR: materialSelect,
                  densidadSNR: materialDensity,
                  updatedAt: new Date().toISOString()
                };
                console.log("Successfully appended log and updated cumulative reports:", reportId);
              }
            } catch (syncErr) {
              console.error("Error syncing to parent environmental report:", syncErr);
            }
          }

          // 1. Update issue state on firestore with custom Aprovechamiento cumulative fields
          await updateDoc(doc(db, 'issues', activeIssue.id), cumulativePayload);

          // 2. Format custom message for Aprovechamiento chat
          messageText = `🌳 **[REGISTRO DE APROVECHAMIENTO Y REUTILIZACIÓN RCD]**

📸 **1. REGISTRO FOTOGRÁFICO DURANTE LA REUTILIZACIÓN**
• (Registrado independientemente durante las etapas de la obra)

📸 **2. REGISTRO FOTOGRÁFICO RESULTADO FINAL DE LA REUTILIZACIÓN**
${mediaFinal.length > 0 
  ? mediaFinal.map(m => `• [Ver Foto Final](${m.url})`).join('\n') 
  : '• (No se adjuntaron fotos del resultado final)'}

📐 **3. DIMENSIONES DE REUTILIZACIÓN (CUBICACIÓN)**
• **Largo (M)**: ${numLargo} m
• **Ancho (M)**: ${numAncho} m
• **Alto / Espesor (M)**: ${numFondo} m
• **Volumen Total calculado**: ${calVolumen.toFixed(1)} m³
• **Área final recuperada**: ${calArea.toFixed(1)} m²

⚖️ **4. DOSIFICACIÓN Y DENSIDAD SNR-10**
• **Material Seleccionado**: ${materialSelect.toUpperCase()}
• **Densidad de Diseño**: ${materialDensity} kg/m³
• **Impacto Estimado en Peso**: ${(calPesoKg / 1000).toFixed(2)} Ton

📝 **5. OBSERVACIÓN / SUSTENTO TÉCNICO**
${textTrimmed || 'Sin observaciones adicionales registradas.'}`;

          commentAttachments = [
            ...mediaFinal.map(m => ({ ...m, category: 'image', name: `FINAL: ${m.name}` }))
          ];

          // Reset inputs
          setAcopioLargo('');
          setAcopioAncho('');
          setAcopioFondo('');
          setAcopioDuracion('');
          setMediaDuring([]);
          setMediaFinal([]);
          setShowAcopioForm(false);
          setNewMessage('');
        } else {
          // General Acopio form logic - Sync directly to report logs automatically
          const reportId = activeIssue.sourceReportId || (activeIssue.id.startsWith('issue_e_apr_') ? activeIssue.id.replace('issue_e_apr_', '') : null);
          let updatePayload = {
            acopioLargo: numLargo,
            acopioAncho: numAncho,
            acopioAlto: numFondo, // Map "fondo" to acopioAlto for issue compatibility
            acopioDuracionProceso: numDuracion,
            acopioVolumen: calVolumen,
            acopioAreaRecuperada: calArea,
            updatedAt: new Date().toISOString()
          };

          if (reportId) {
            try {
              const reportRef = doc(db, 'reports', reportId);
              const reportSnap = await getDoc(reportRef);
              if (reportSnap.exists()) {
                const reportData = reportSnap.data();
                const existingLogs = reportData.logs || [];

                // Create the new log entry
                const newLog = {
                  id: 'log-' + Math.random().toString(36).substr(2, 9),
                  material: 'PETREOS',
                  quantity: calVolumen * 2300,
                  unit: 'KG', // Standard KG for consistency across reports
                  recipient: 'OBRA (REUTILIZACIÓN AUTÓCTONA)',
                  certificateCode: 'AUT-RCD',
                  date: new Date().toISOString().split('T')[0],
                  observations: textTrimmed || 'Control de Acopio de Material RCD.',
                  status: 'APROVECHADO',
                  largo: numLargo,
                  ancho: numAncho,
                  alto: numFondo,
                  duracionProceso: numDuracion,
                  volumenReutilizado: calVolumen,
                  areaRecuperada: calArea,
                  materialSNR: 'Concreto simple',
                  densidadSNR: 2300
                };

                const updatedLogs = [...existingLogs, newLog];

                // Calculate cumulative values across all logs
                let totalVolumen = 0;
                let totalArea = 0;
                let maxLargo = 0;
                let maxAncho = 0;
                let maxAlto = 0;
                let maxDuracion = 30;

                updatedLogs.forEach((log: any) => {
                  totalVolumen += Number(log.volumenReutilizado) || 0;
                  totalArea += Number(log.areaRecuperada) || 0;
                  if (Number(log.largo) > maxLargo) maxLargo = Number(log.largo);
                  if (Number(log.ancho) > maxAncho) maxAncho = Number(log.ancho);
                  const logAlto = log.alto !== undefined ? log.alto : log.fondo;
                  if (Number(logAlto) > maxAlto) maxAlto = Number(logAlto);
                  if (Number(log.duracionProceso) > maxDuracion || maxDuracion === 30) {
                    maxDuracion = Number(log.duracionProceso);
                  }
                });

                await updateDoc(reportRef, {
                  logs: updatedLogs,
                  updatedAt: new Date().toISOString()
                });

                // Update cumulative payload for the issue
                updatePayload = {
                  acopioLargo: maxLargo,
                  acopioAncho: maxAncho,
                  acopioAlto: maxAlto,
                  acopioDuracionProceso: maxDuracion,
                  acopioVolumen: totalVolumen,
                  acopioAreaRecuperada: totalArea,
                  updatedAt: new Date().toISOString()
                };
                console.log("Successfully appended general acopio log to parent report:", reportId);
              }
            } catch (syncErr) {
              console.error("Error syncing general acopio form to parent report:", syncErr);
            }
          }

          await updateDoc(doc(db, 'issues', activeIssue.id), updatePayload);

          const formMsgText = `📦 **[RESPUESTA DE CONTROL DE ACOPIO - CUBICACIÓN]**
• **Largo del Espacio**: ${numLargo} ml
• **Ancho del Espacio**: ${numAncho} ml
• **Fondo del Espacio**: ${numFondo} ml
• **Volumen Total Reutilizado**: ${calVolumen.toFixed(1)} m³
• **Área Final Recuperada**: ${calArea.toFixed(1)} m²
• **Proceso Total en Obra**: ${numDuracion} días
${textTrimmed ? `\n• **Sustento / Observaciones**: ${textTrimmed}` : ''}`;

          messageText = formMsgText;

          // Reset form inputs
          setAcopioLargo('');
          setAcopioAncho('');
          setAcopioFondo('');
          setAcopioDuracion('');
          setShowAcopioForm(false);
        }
      } else {
        setNewMessage('');
      }

      await addDoc(collection(db, 'issues', activeIssue.id, 'comments'), {
        userId: user.id,
        userName: user.name,
        text: messageText,
        createdAt: new Date().toISOString(),
        userAvatar: user.name.charAt(0),
        ...(commentAttachments.length > 0 ? { attachments: commentAttachments } : {})
      });

      await updateDoc(doc(db, 'issues', activeIssue.id), {
        updatedAt: new Date().toISOString()
      });

      if (!hasForm) {
        setNewMessage('');
      }
    } catch (error) {
      console.error("Error sending message or updating acopio:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user || !activeIssue) return;

    const file = files[0];
    const category = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : 'file';

    try {
      // 1. Prepare Base64 as a quick and reliable fallback
      const base64UrlPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      let url = "";
      let driveFileId = "";
      let webViewLink = "";
      let uploadSuccess = false;

      const gToken = googleAccessToken || localStorage.getItem('google_drive_token');
      if (gToken) {
        try {
          console.log("Attempting direct upload to Google Drive first for file:", file.name);
          const driveResult = await uploadFileToDrive(file, file.name, file.type, '1Bym51TtKVSzDsweJaMAh0VxCAAQQbU3w', gToken);
          url = driveResult.url;
          driveFileId = driveResult.id;
          webViewLink = driveResult.webViewLink;
          uploadSuccess = true;
          console.log("Google Drive upload successful:", driveResult);
        } catch (driveErr) {
          console.warn("Google Drive upload failed inside chat upload, falling back to Firebase/Base64:", driveErr);
        }
      }

      if (!uploadSuccess) {
        try {
          // Try uploading to Firebase Storage with a 4 second timeout fallback
          const uploadPromise = async () => {
            const storageRef = ref(storage, `issues/${activeIssue.id}/${Date.now()}_${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            return await getDownloadURL(uploadResult.ref);
          };

          const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Firebase Storage took too long.")), 4000)
          );

          url = await Promise.race([uploadPromise(), timeoutPromise]);
        } catch (uploadErr) {
          console.warn("Storage upload took fallback route to Base64 in chat:", uploadErr);
          url = await base64UrlPromise;
        }
      }

      const attachment: Attachment = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type,
        url,
        category: category as any,
        ...(driveFileId ? { driveFileId } : {}),
        ...(webViewLink ? { webViewLink } : {})
      };

      await addDoc(collection(db, 'issues', activeIssue.id, 'comments'), {
        userId: user.id,
        userName: user.name,
        text: `Ha adjuntado un archivo: ${file.name}${driveFileId ? ' (Guardado directamente en Google Drive)' : ''}`,
        createdAt: new Date().toISOString(),
        userAvatar: user.name.charAt(0),
        attachments: [attachment]
      });

      await updateDoc(doc(db, 'issues', activeIssue.id), {
        updatedAt: new Date().toISOString()
      });

      // Synchronize directly into parent environmental report's mediaDuring array
      const reportId = activeIssue.sourceReportId || (activeIssue.id.startsWith('issue_e_apr_') ? activeIssue.id.replace('issue_e_apr_', '') : null);
      if (reportId && (activeIssue.reportType === 'ENVIRONMENTAL' || activeIssue.id.startsWith('issue_e_apr_'))) {
        try {
          const reportRef = doc(db, 'reports', reportId);
          const reportSnap = await getDoc(reportRef);
          if (reportSnap.exists()) {
            const reportData = reportSnap.data();
            const existingMediaDuring = reportData.mediaDuring || [];
            await updateDoc(reportRef, {
              mediaDuring: [...existingMediaDuring, attachment],
              updatedAt: new Date().toISOString()
            });
            console.log("Chat file upload successfully synchronized to parent environmental report:", reportId);
          }
        } catch (syncErr) {
          console.error("Error syncing general chat upload to parent report:", syncErr);
        }
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  if (!selectedIssue) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-[#020617] relative overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.03),transparent)] dark:bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.03),transparent)] pointer-events-none" />
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl shadow-slate-200/20 dark:shadow-slate-900/20 transform hover:scale-105 transition-all duration-500 border border-slate-200 dark:border-slate-800/50">
          <MessageSquare className="w-10 h-10 text-slate-900 dark:text-white" />
        </div>
        <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight uppercase">
          Gestión de Trazabilidad<br/>
          <span className="text-slate-400 dark:text-slate-500">y Resoluciones</span>
        </h2>
        <p className="text-slate-500 text-[8px] mt-6 max-w-[240px] font-black uppercase tracking-[0.3em] leading-relaxed">
          Selección de registro requerida. Interactúe con los responsables para validar evidencias técnicas.
        </p>
      </div>
    );
  }

  const effectiveStatus = getEffectiveStatus(activeIssue);
  
  const isQuality = activeIssue.reportType === 'QUALITY';
  const isClosed = effectiveStatus === 'RESUELTA';
  const isAuthorized = isAuthorizedForQualityFollowUp(activeIssue, user);
  
  const isMedAlert = isMedicionAlertActive(activeIssue);
  const isEfiAlert = isEficaciaAlertActive(activeIssue);
  
  const medComp = !!activeIssue.medicionInicial?.completed;
  const efiComp = !!activeIssue.revisionEficacia?.completed;
  
  const medDueDate = getMedicionDueDate(activeIssue);
  const efiDueDate = getEficaciaDueDate(activeIssue);

  const statusColors = 
    effectiveStatus === 'VENCIDA' ? 'text-red-650 border-red-500/20 bg-red-500/10' :
    effectiveStatus === 'ACUERDO' ? 'text-indigo-600 border-indigo-500/20 bg-indigo-500/10' :
    effectiveStatus === 'RESPONDIDA' ? 'text-amber-600 border-amber-500/20 bg-amber-500/10' :
    effectiveStatus === 'RESUELTA' ? 'text-emerald-600 border-emerald-500/20 bg-emerald-500/10' :
    effectiveStatus === 'ACTIVO' ? 'text-blue-600 border-blue-500/20 bg-blue-500/10' :
    effectiveStatus === 'RECHAZADA' ? 'text-orange-600 border-orange-500/20 bg-orange-500/10' :
    effectiveStatus === 'ANULADA' ? 'text-slate-400 border-slate-200 bg-slate-100' :
    'text-blue-600 border-blue-500/20 bg-blue-500/10';

  const participants = [
    { name: activeIssue.creatorName, role: 'Creador' },
    { name: activeIssue.assignedName, role: 'Responsable' },
    ...activeIssue.reviewers.map(r => ({ name: r, role: 'Revisor' }))
  ].filter(p => p.name);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black relative transition-colors duration-200">
      {/* Chat Header - Higher density */}
      <header className="p-4 border-b border-slate-100 dark:border-[#1a1a1a] bg-white/80 dark:bg-black/80 backdrop-blur-xl flex items-center justify-between sticky top-0 z-20">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
             <div className="px-2 py-0.5 bg-slate-900 dark:bg-white rounded-md shrink-0">
              <span className="text-[7.5px] font-black text-white dark:text-black font-mono tracking-widest uppercase">{activeIssue.code || activeIssue.id.slice(0, 4)}</span>
             </div>
             <h2 className="text-xs font-display font-black text-slate-900 dark:text-white truncate tracking-tight uppercase leading-none">{activeIssue.title}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-1">
               {participants.map((p, i) => (
                  <div 
                    key={i} 
                    className="w-5 h-5 rounded-md bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1a1a1a] flex items-center justify-center text-[7.5px] font-black text-slate-400 dark:text-slate-600 shadow-sm"
                    title={`${p.name} (${p.role})`}
                  >
                     {p.name?.charAt(0)}
                  </div>
               ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[7px] text-slate-400 dark:text-slate-700 font-black uppercase tracking-widest">Auditoría Activa</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
           <div className={cn(
             "px-3 py-1.5 border rounded-lg shadow-sm transition-all duration-300 text-[8px] font-black uppercase tracking-widest leading-none",
             statusColors
           )}>
              {effectiveStatus}
           </div>
           <button className="p-1.5 text-slate-300 hover:text-slate-900 dark:text-slate-800 dark:hover:text-white transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
         </div>
      </header>
      {/* Follow-Up Status/Control Banner */}
      {isQuality && isClosed && (
        <div className="border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 shrink-0 font-sans">
          
          {/* Collapsible Header/Toggle */}
          <div 
            onClick={() => setIsFollowUpCollapsed(!isFollowUpCollapsed)}
            className="flex items-center justify-between px-5 py-3.5 bg-slate-100/30 dark:bg-slate-950/30 hover:bg-slate-200/40 dark:hover:bg-slate-900/40 cursor-pointer transition-all select-none border-b border-slate-150 dark:border-slate-900 focus:outline-none"
            id="collapsible-followup-header"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
              </span>
              <span className="text-[9.5px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                Seguimientos de Control de Calidad
              </span>
              <div className="hidden sm:flex items-center gap-1.5 text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                <span>• Mediciones:</span>
                <span className={cn("px-1.5 py-0.5 rounded text-[7px]", medComp ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-200/50 dark:bg-slate-900/50 text-slate-400")}>Inicial ({medComp ? 'Ok' : 'Pendiente'})</span>
                <span className={cn("px-1.5 py-0.5 rounded text-[7px]", efiComp ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-200/50 dark:bg-slate-900/50 text-slate-400")}>Eficacia ({efiComp ? 'Ok' : 'Pendiente'})</span>
                {activeIssue.extraordinarias && activeIssue.extraordinarias.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 text-[7px] font-bold">+{activeIssue.extraordinarias.length} Extra</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {(isMedAlert || isEfiAlert) && (
                <span className="px-2.5 py-1 rounded-md bg-red-650 text-white text-[7.5px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-lg shadow-red-600/20">
                  <AlertCircle className="w-3 h-3" /> ALERTA DE SEGUIMIENTO REQUERIDO
                </span>
              )}
              <div className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800/70 transition-colors">
                {isFollowUpCollapsed ? (
                  <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {!isFollowUpCollapsed && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-5 border-t border-slate-100 dark:border-slate-900 bg-white/40 dark:bg-black/5 flex flex-col gap-4">
                  {/* Active Alert banner */}
                  {(isMedAlert || isEfiAlert) && (
                    <div className="px-4 py-2.5 bg-red-550/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 animate-pulse">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>ALERTA DE SEGUIMIENTO REQUERIDA (Período de Auditoría de Calidad Vencido o Próximo)</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Seguimientos Técnicos Mandatorios</span>
                    {isAuthorized && (
                      <button 
                        onClick={() => { setShowFollowUpForm("extraordinaria"); setFollowUpNotes(''); setFollowUpValoration('EFICAZ'); }}
                        className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-600/20 shrink-0 select-none"
                      >
                        + Registrar Medición Extraordinaria
                      </button>
                    )}
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-3">
                    {/* MEDICIÓN INICIAL card */}
                    <div className={cn(
                      "flex-1 p-4 rounded-2xl border transition-all duration-300",
                      medComp 
                        ? "bg-emerald-500/5 border-emerald-500/10 dark:border-emerald-500/20" 
                        : isMedAlert 
                          ? "bg-red-500/5 border-red-550/20 animate-pulse" 
                          : "bg-white dark:bg-[#070709] border-slate-200 dark:border-slate-850"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8.5px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest flex flex-wrap gap-1 items-center">
                          <span>1. MEDICIÓN INICIAL (1 Mes)</span>
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-[7px] font-bold">[{activeIssue.medicionInicial?.code || generateFollowUpCode(activeIssue, 1)}]</span>
                        </span>
                        {medComp ? (
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-emerald-500 px-1.5 py-0.5 bg-emerald-500/10 rounded">Completado ✅</span>
                        ) : isMedAlert ? (
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-red-500 px-1.5 py-0.5 bg-red-550/10 rounded animate-pulse">⚠️ ALERTA</span>
                        ) : (
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-slate-400 px-1.5 py-0.5 bg-slate-500/10 rounded">Pendiente</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 mb-2">
                        <span>Plazo de Entrega:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{medDueDate ? format(medDueDate, 'dd/MM/yyyy') : '-'}</span>
                      </div>
                      
                      {medComp ? (
                        <div className="text-[8.5px] text-slate-500 italic mt-1 border-t border-slate-100 dark:border-slate-900 pt-1.5 line-clamp-2">
                          Valoración: <strong className={activeIssue.medicionInicial?.valoration === 'EFICAZ' ? 'text-emerald-500' : 'text-rose-500'}>{activeIssue.medicionInicial?.valoration}</strong>. Nota: "{activeIssue.medicionInicial?.notes}"
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {isAuthorized ? (
                            <button 
                              onClick={() => { setShowFollowUpForm("medicion"); setFollowUpNotes(''); setFollowUpValoration('EFICAZ'); }}
                              className="w-full py-2 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#020617] rounded-lg text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                            >
                              Registrar Medición Inicial
                            </button>
                          ) : (
                            <span className="text-[7px] text-slate-500 italic leading-tight">Solo el creador o equipo Calidad pueden registrar el seguimiento.</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* REVISIÓN EFICACIA card */}
                    <div className={cn(
                      "flex-1 p-4 rounded-2xl border transition-all duration-300",
                      efiComp 
                        ? "bg-emerald-500/5 border-emerald-500/10 dark:border-emerald-500/20" 
                        : isEfiAlert 
                          ? "bg-red-500/5 border-red-550/20 animate-pulse" 
                          : "bg-white dark:bg-[#070709] border-slate-200 dark:border-slate-850"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[8.5px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest flex flex-wrap gap-1 items-center">
                          <span>2. REVISIÓN EFICACIA (3 Meses)</span>
                          <span className="text-slate-400 dark:text-slate-500 font-mono text-[7px] font-bold">[{activeIssue.revisionEficacia?.code || generateFollowUpCode(activeIssue, 2)}]</span>
                        </span>
                        {efiComp ? (
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-emerald-500 px-1.5 py-0.5 bg-emerald-500/10 rounded">Completado ✅</span>
                        ) : isEfiAlert ? (
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-red-500 px-1.5 py-0.5 bg-red-550/10 rounded animate-pulse">⚠️ ALERTA</span>
                        ) : (
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-slate-400 px-1.5 py-0.5 bg-slate-500/10 rounded">Pendiente</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 mb-2">
                        <span>Plazo de Entrega:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{efiDueDate ? format(efiDueDate, 'dd/MM/yyyy') : '-'}</span>
                      </div>
                      
                      {efiComp ? (
                        <div className="text-[8.5px] text-slate-500 italic mt-1 border-t border-slate-100 dark:border-slate-900 pt-1.5 line-clamp-2">
                          Valoración: <strong className={activeIssue.revisionEficacia?.valoration === 'EFICAZ' ? 'text-emerald-500' : 'text-rose-500'}>{activeIssue.revisionEficacia?.valoration}</strong>. Nota: "{activeIssue.revisionEficacia?.notes}"
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {isAuthorized ? (
                            <button 
                              onClick={() => { setShowFollowUpForm("eficacia"); setFollowUpNotes(''); setFollowUpValoration('EFICAZ'); }}
                              className="w-full py-2 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#020617] rounded-lg text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                            >
                              Registrar Revisión Eficacia
                            </button>
                          ) : (
                            <span className="text-[7px] text-slate-500 italic leading-tight">Solo el creador o equipo Calidad pueden registrar el seguimiento.</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EXTRAORDINARY MEASUREMENTS LIST */}
                  {activeIssue.extraordinarias && activeIssue.extraordinarias.length > 0 && (
                    <div className="mt-2 pt-4 border-t border-slate-150 dark:border-slate-800/85">
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Seguimientos Extraordinarios Registrados</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeIssue.extraordinarias.map((extra, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border bg-indigo-500/5 border-indigo-500/10 dark:border-indigo-500/20 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[8.5px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">
                                MEDICIÓN EXTRAORDINARIA {extra.consecutive}
                              </span>
                              <span className="text-[7.5px] font-black uppercase tracking-widest text-[#6366f1] px-1.5 py-0.5 bg-[#6366f1]/10 rounded">EXTRA</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 mb-2">
                              <span>Código de Registro:</span>
                              <span className="font-mono font-bold text-[#6366f1]">{extra.code}</span>
                            </div>
                            <div className="text-[8.5px] text-slate-500 italic mt-1 border-t border-slate-100 dark:border-slate-900 pt-1.5 line-clamp-2">
                              Valoración: <strong className={extra.valoration === 'EFICAZ' ? 'text-emerald-500' : 'text-rose-500'}>{extra.valoration === 'EFICAZ' ? 'EFICAZ 🟢' : 'NO EFICAZ 🔴'}</strong>. Por: <strong>{extra.completedByName}</strong>. Nota: "{extra.notes}"
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Active Dialog / Form Panel */}
                  {showFollowUpForm && (
                    <div className="mt-2 p-5 bg-slate-100 dark:bg-[#070709] border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col gap-3 animate-in slide-in-from-top-3 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black text-slate-700 dark:text-white uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          Registrar {showFollowUpForm === 'medicion' ? 'MEDICIÓN INICIAL' : showFollowUpForm === 'eficacia' ? 'REVISIÓN EFICACIA' : 'MEDICIÓN EXTRAORDINARIA'}
                        </span>
                        <button onClick={() => setShowFollowUpForm(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                          <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-white" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        {/* Valoration check */}
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">VALORACIÓN DEL SEGUIMIENTO:</p>
                          <div className="flex gap-2.5">
                            <button 
                              type="button"
                              onClick={() => setFollowUpValoration('EFICAZ')}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border",
                                followUpValoration === 'EFICAZ' 
                                  ? "bg-emerald-600 border-emerald-650 text-white shadow-lg shadow-emerald-600/10" 
                                  : "bg-white dark:bg-[#020617] border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                              )}
                            >
                              EFICAZ 🟢
                            </button>
                            <button 
                              type="button"
                              onClick={() => setFollowUpValoration('NO_EFICAZ')}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border",
                                followUpValoration === 'NO_EFICAZ' 
                                  ? "bg-rose-600 border-rose-650 text-white shadow-lg shadow-rose-600/10" 
                                  : "bg-white dark:bg-[#020617] border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                              )}
                            >
                              NO EFICAZ 🔴
                            </button>
                          </div>
                        </div>
                        
                        {/* Text Notes */}
                        <div>
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">ANÁLISIS TÉCNICO Y OBSERVACIONES:</p>
                          <textarea 
                            value={followUpNotes}
                            onChange={(e) => setFollowUpNotes(e.target.value)}
                            placeholder="Escriba los detalles, observaciones y sustento técnico del seguimiento..."
                            className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-850 rounded-xl p-3.5 text-[10.5px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-700 font-bold h-24 outline-none focus:border-indigo-500 resize-none transition-all shadow-inner"
                          />
                        </div>
                        
                        <button 
                          onClick={() => handleSaveFollowUp(showFollowUpForm)}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-xl shadow-indigo-600/10 active:scale-95 transition-all"
                        >
                          Confirmar y Guardar Registro en Chat
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-10 custom-scrollbar"
      >
        <div className="flex flex-col items-center justify-center mb-12 relative">
          <div className="absolute inset-x-0 top-1/2 h-px bg-slate-100 dark:bg-slate-800/30 -z-10" />
          <div className="px-6 py-2 bg-white dark:bg-[#020617] border border-slate-100 dark:border-slate-800 shadow-xl rounded-full transition-colors duration-300">
            <span className="text-[8px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-[0.3em]">Protocolo de trazabilidad iniciado</span>
          </div>
        </div>
        
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => {
            const isMe = msg.userId === user?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex gap-4 max-w-[90%]",
                  isMe ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-slate-500 shrink-0 shadow-sm self-end mb-1 transition-colors duration-300">
                  {msg.userName?.charAt(0)}
                </div>
                <div className="space-y-3 flex-1 lg:max-w-[80%]">
                   <div className={cn(
                     "p-6 rounded-[2rem] relative shadow-xl transition-all group",
                     isMe 
                       ? "bg-slate-900 dark:bg-[#1e293b] text-white rounded-br-none shadow-black/5 dark:shadow-black/20" 
                       : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-800 shadow-slate-200/5 dark:shadow-black/10"
                   )}>
                      <div className={cn("flex justify-between items-center mb-4 gap-4", isMe ? "flex-row-reverse" : "")}>
                         <div className={cn("flex flex-col", isMe ? "text-right" : "text-left")}>
                           <span className={cn("text-[9px] font-black uppercase tracking-[0.1em]", isMe ? "text-blue-400 dark:text-blue-400" : "text-slate-900 dark:text-white")}>{msg.userName}</span>
                           <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1 opacity-60">Cargo Auditado</span>
                         </div>
                         <span className={cn("text-[8px] font-black uppercase tracking-widest opacity-40", isMe ? "text-slate-400" : "text-slate-500")}>{format(new Date(msg.createdAt), 'HH:mm')}</span>
                      </div>
                      <p className="text-[13px] leading-relaxed font-medium tracking-tight whitespace-pre-wrap">{msg.text}</p>
                      
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-6 grid grid-cols-1 gap-3">
                           {msg.attachments.map((att) => (
                              <a 
                                key={att.id} 
                                href={att.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className={cn(
                                  "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group/att",
                                  isMe ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-[#020617]/50 border-slate-800 hover:bg-slate-800/50"
                                )}
                              >
                                 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover/att:scale-110", isMe ? "bg-white/10 text-white" : "bg-slate-900 text-slate-400")}>
                                   {att.category === 'image' ? <ImageIcon className="w-4 h-4" /> : 
                                    att.category === 'video' ? <Video className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
                                 </div>
                                 <div className="flex flex-col overflow-hidden text-left flex-1">
                                   <span className={cn("text-[11px] font-black truncate tracking-tight", isMe ? "text-white" : "text-slate-100")}>{att.name}</span>
                                   <span className={cn("text-[8px] font-bold uppercase tracking-widest mt-0.5", isMe ? "text-white/20" : "text-slate-600")}>Evidencia Técnica Sincronizada</span>
                                 </div>
                                 <div className="opacity-0 group-hover/att:opacity-100 transition-opacity pr-1">
                                    <Clock className={cn("w-3.5 h-3.5", isMe ? "text-white/40" : "text-slate-600")} />
                                 </div>
                              </a>
                           ))}
                        </div>
                      )}

                      <div className={cn("flex items-center gap-4 mt-6 border-t pt-4", isMe ? "border-white/5" : "border-slate-800/50")}>
                         <div className="flex items-center gap-2">
                            <button className={cn("p-1.5 rounded-lg transition-all hover:scale-110", isMe ? "hover:bg-white/10 text-white" : "hover:bg-slate-800 text-slate-500")}><ThumbsUp className="w-3.5 h-3.5" /></button>
                            <button className={cn("p-1.5 rounded-lg transition-all hover:scale-110", isMe ? "hover:bg-white/10 text-white" : "hover:bg-slate-800 text-slate-500")}><ThumbsDown className="w-3.5 h-3.5" /></button>
                         </div>
                         <div className={cn("ml-auto flex items-center gap-6 text-[8px] font-black uppercase tracking-[0.2em]", isMe ? "text-slate-500" : "text-slate-600")}>
                            <span className="hover:text-blue-400 cursor-pointer transition-colors">Protocolar</span>
                            <span className="hover:text-amber-400 cursor-pointer transition-colors">Exportar</span>
                         </div>
                      </div>
                   </div>
                 </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

       {/* Input Bar */}
      <div className="p-6 lg:p-10 pt-0">
         <div className="bg-white dark:bg-[#020617]/80 backdrop-blur-2xl border border-slate-200 dark:border-slate-800/50 rounded-[2.5rem] lg:rounded-[3.5rem] p-4 shadow-2xl relative transition-colors duration-300">
            <div className="flex items-center gap-3 mb-4 ml-6 lg:ml-10">
               <div className="flex items-center bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-800/50">
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all" title="Audio"><Mic className="w-3.5 h-3.5" /></button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all" title="Video"><Video className="w-3.5 h-3.5" /></button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all" title="Imagen"><ImageIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all" title="Archivo"><FilePlus className="w-3.5 h-3.5" /></button>
                <button
                  type="button"
                  onClick={() => setShowAcopioForm(!showAcopioForm)}
                  className={cn(
                    "p-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none select-none",
                    showAcopioForm 
                      ? "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/5 whitespace-nowrap" 
                      : "text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                  )}
                  title={isAprovechamientoIssue ? "Responder Registro de Reutilización RCD" : "Registrar Cubicación del Acopio"}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="text-[7.5px] font-black uppercase tracking-wider hidden sm:inline">
                    {isAprovechamientoIssue ? "🌳 Reutilización RCD" : "📐 Cubicar"}
                  </span>
                </button>
                {isAprovechamientoIssue && (
                  <div className="flex items-center gap-1.5 animate-in fade-in-20 duration-200">
                    <button
                      type="button"
                      onClick={() => duranteFileInputRef.current?.click()}
                      disabled={isUploadingDuring}
                      className="p-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none select-none text-blue-500 hover:bg-blue-500/10 dark:hover:bg-blue-500/5 cursor-pointer"
                      title="Subir Registro de EVIDENCIA (Foto/Video) Durante la Reutilización (En cualquier etapa)"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span className="text-[7.5px] font-black uppercase tracking-wider hidden sm:inline">
                        {isUploadingDuring ? "⏳ Subiendo..." : "📂 Cargar Durante"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startCamera('during')}
                      className="p-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none select-none text-indigo-500 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/5 cursor-pointer"
                      title="Capturar EVIDENCIA (Foto/Video) Durante con la Cámara"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span className="text-[7.5px] font-black uppercase tracking-wider hidden sm:inline">
                        📸 Cámara Durante
                      </span>
                    </button>
                  </div>
                )}
               </div>
               <div className="w-px h-5 bg-slate-200 dark:bg-slate-800/50 mx-3 lg:mx-4" />
               <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Canal de Evidencias Digitales V2</span>
            </div>

            {showAcopioForm && isAprovechamientoIssue ? (
              <div className="mb-4 mx-6 lg:mx-10 p-6 bg-slate-50 dark:bg-[#070709] border border-slate-200 dark:border-slate-850 rounded-[2rem] flex flex-col gap-6 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    📝 Registro de Aprovechamiento y Reutilización RCD
                  </span>
                  <button type="button" onClick={() => setShowAcopioForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors p-1.5 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Category 2: Resultado Final */}
                  <div className="p-5 bg-white dark:bg-black rounded-2xl border border-slate-150 dark:border-slate-850 shadow-sm flex flex-col h-full justify-between">
                    <div>
                      <span className="block text-[8.5px] font-black uppercase text-slate-500 tracking-wider mb-2">1. Registro Fotográfico Resultado Final de la Reutilización</span>
                      <p className="text-[7.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-4">Cargue fotos o capture evidencias del estado final de los materiales ya reutilizados.</p>
                      
                      {mediaFinal.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                          {mediaFinal.map((m, idx) => (
                            <div key={m.id} className="relative aspect-video rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 group">
                              <img src={m.url} alt="Final" className="w-full h-full object-cover" />
                              <button 
                                type="button"
                                onClick={() => setMediaFinal(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 p-1 bg-red-650 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <input 
                        type="file" 
                        ref={finalFileInputRef} 
                        onChange={(e) => handleSpecificUpload(e, 'final')} 
                        className="hidden" 
                        accept="image/*,video/*"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => finalFileInputRef.current?.click()}
                          disabled={isUploadingFinal}
                          className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-300 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all"
                        >
                          {isUploadingFinal ? 'Subiendo...' : '➕ Cargar Foto/Video'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startCamera('final')}
                          className="py-2.5 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>📸 Usar Cámara</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category 3 & 4: Dimensiones y Densidad */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-white dark:bg-black rounded-2xl border border-slate-150 dark:border-slate-850 shadow-sm">
                  <div className="space-y-1">
                    <label className="block text-[8.5px] font-black uppercase text-slate-500 tracking-wider">Largo (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={acopioLargo}
                      onChange={(e) => setAcopioLargo(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Largo..."
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[8.5px] font-black uppercase text-slate-500 tracking-wider">Ancho (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={acopioAncho}
                      onChange={(e) => setAcopioAncho(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Ancho..."
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[8.5px] font-black uppercase text-slate-500 tracking-wider">Alto / Espesor (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={acopioFondo}
                      onChange={(e) => setAcopioFondo(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Alto/Espesor..."
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[8.5px] font-black uppercase text-slate-500 tracking-wider">Densidad SNR-10</label>
                    <select
                      value={materialSelect}
                      onChange={(e) => {
                        const matName = e.target.value;
                        setMaterialSelect(matName);
                        const match = RCD_MATERIALS.find(m => m.material === matName);
                        if (match) setMaterialDensity(match.density);
                      }}
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-205 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500"
                    >
                      {RCD_MATERIALS.map(m => (
                        <option key={m.material} value={m.material}>{m.material.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub calculations */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl text-xs font-bold text-center">
                  <div>
                    <span className="block text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Volumen Reutilizado</span>
                    <span className="text-[13px] font-mono text-emerald-500 dark:text-emerald-400">
                      {((Number(acopioLargo) || 0) * (Number(acopioAncho) || 0) * (Number(acopioFondo) || 0)).toFixed(1)} m³
                    </span>
                  </div>
                  <div>
                    <span className="block text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Área Final Recuperada</span>
                    <span className="text-[13px] font-mono text-teal-500 dark:text-teal-400">
                      {((Number(acopioLargo) || 0) * (Number(acopioAncho) || 0)).toFixed(1)} m²
                    </span>
                  </div>
                  <div>
                    <span className="block text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-center gap-1">Densidad Asignada ({materialDensity} kg/m³)</span>
                    <span className="text-[13px] font-mono text-blue-500 dark:text-blue-400">
                      {((((Number(acopioLargo) || 0) * (Number(acopioAncho) || 0) * (Number(acopioFondo) || 0)) * materialDensity) / 1000).toFixed(2)} Ton
                    </span>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAcopioForm(false)}
                    className="py-2.5 px-5 border border-slate-250 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={acopioLargo === '' || acopioAncho === '' || acopioFondo === ''}
                    className="py-2.5 px-6 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-98 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-extrabold"
                  >
                    🚀 Enviar Registro de Aprovechamiento
                  </button>
                </div>
              </div>
            ) : showAcopioForm && (
              <div className="mb-4 mx-6 lg:mx-10 p-5 bg-slate-50 dark:bg-[#070709] border border-slate-200 dark:border-slate-850 rounded-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-black text-slate-705 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Cubicación de Espacio de Acopio (Formulario de Respuesta)
                  </span>
                  <button type="button" onClick={() => setShowAcopioForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {/* Largo Input */}
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Largo del Espacio (m)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={acopioLargo}
                        onChange={(e) => setAcopioLargo(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Largo..."
                        className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Ancho Input */}
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Ancho del Espacio (m)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={acopioAncho}
                        onChange={(e) => setAcopioAncho(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ancho..."
                        className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Fondo Input */}
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Fondo / Espesor (m)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={acopioFondo}
                        onChange={(e) => setAcopioFondo(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Fondo..."
                        className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Duración Input */}
                  <div className="space-y-1">
                    <label className="block text-[8px] font-black uppercase text-slate-500 tracking-wider">Proceso total (días)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        value={acopioDuracion}
                        onChange={(e) => setAcopioDuracion(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Días..."
                        className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Live calculations */}
                <div className="flex gap-4 p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-semibold">
                  <div className="flex-1">
                    <span className="block text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Volumen Total Reutilizado</span>
                    <span className="text-[14px] font-display font-black text-slate-800 dark:text-emerald-400">
                      {((Number(acopioLargo) || 0) * (Number(acopioAncho) || 0) * (Number(acopioFondo) || 0)).toFixed(1)} m³
                    </span>
                  </div>
                  <div className="w-px bg-slate-200 dark:bg-slate-800" />
                  <div className="flex-1">
                    <span className="block text-[7.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Área Final Recuperada</span>
                    <span className="text-[14px] font-display font-black text-slate-800 dark:text-teal-400">
                      {((Number(acopioLargo) || 0) * (Number(acopioAncho) || 0)).toFixed(1)} m²
                    </span>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAcopioForm(false)}
                    className="py-2.5 px-5 border border-slate-250 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={acopioLargo === '' || acopioAncho === '' || acopioFondo === ''}
                    className="py-2.5 px-6 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-98 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-extrabold"
                  >
                    🚀 Enviar Registro de Cubicación
                  </button>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-white dark:bg-black rounded-xl p-1 pl-4 pr-1 border border-slate-200 dark:border-[#1a1a1a] focus-within:border-amber-500/50 transition-all">
              <textarea 
                placeholder={showAcopioForm ? "Sustento, observaciones o detalles de la cubicación..." : "Obs. técnicas o sustento..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 bg-transparent border-none py-2 text-[11px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-800 font-bold focus:ring-0 outline-none resize-none max-h-24"
              />
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition-all"><Paperclip className="w-4 h-4" /></button>
                <button 
                  type="submit"
                  disabled={!newMessage.trim() && !(showAcopioForm && acopioLargo !== '' && acopioAncho !== '' && acopioFondo !== '')}
                  className="w-10 h-10 bg-slate-900 dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center hover:opacity-90 transition-all active:scale-95 disabled:opacity-20 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
         </div>
         <input 
           type="file" 
           ref={fileInputRef} 
           onChange={handleFileUpload}
           className="hidden" 
           multiple
         />
         <input 
           type="file" 
           ref={duranteFileInputRef} 
           onChange={(e) => handleSpecificUpload(e, 'during')} 
           className="hidden" 
           accept="image/*,video/*"
         />

          {/* Live Camera Dialog Modal for Chat y RCD */}
          <AnimatePresence>
            {isCameraActive && (
              <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in text-white text-sans">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-white relative font-sans"
                >
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-500/15 rounded-xl border border-emerald-500/20">
                        {cameraMode === 'photo' ? (
                          <Camera className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Video className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider block font-sans">Cámara del Dispositivo (Chat)</span>
                        <span className="text-[8px] font-bold text-slate-400 tracking-wider uppercase block font-sans">
                          {cameraMode === 'photo' ? 'Capturar Evidencia Fotográfica' : 'Grabar Evidencia en Video'}
                        </span>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={stopCamera}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Viewfinder/Preview Container */}
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden font-bold">
                    {cameraStream ? (
                      <video
                        ref={(el) => {
                          if (el && cameraStream) {
                            try {
                              el.srcObject = cameraStream;
                              el.play().catch(e => console.warn("Video play error:", e));
                            } catch (err) {
                              console.error("Stream attachment failed:", err);
                            }
                          }
                        }}
                        playsInline
                        muted
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="p-8 text-center max-w-sm flex flex-col items-center">
                        {cameraError ? (
                          <>
                            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                            <p className="text-[10px] font-black uppercase text-amber-500 tracking-wide mb-2 font-sans">Simulador de Cámara Activo</p>
                            <p className="text-[8.5px] text-slate-305 font-semibold uppercase leading-normal mb-3 font-sans">{cameraError}</p>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-[9px] font-black uppercase tracking-wider font-sans">Iniciando Cámara...</p>
                          </>
                        )}
                        {/* Simulator fallback hint */}
                        <div className="mt-2 p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-left">
                          <p className="text-[7.5px] text-slate-450 font-extrabold uppercase tracking-widest mb-1 font-sans">ASISTENCIA DIGITAL ACTIVA</p>
                          <p className="text-[8px] text-slate-300 leading-relaxed uppercase font-sans">Si las restricciones del explorador impiden encender el hardware, pulse el botón de captura central inferior para registrar y simular con totales garantías.</p>
                        </div>
                      </div>
                    )}

                    {/* Recording Timer / State */}
                    {isCameraRecording && (
                      <div className="absolute top-4 left-4 bg-red-500/95 text-white px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse">
                        <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                        <span className="text-[8px] font-bold font-mono tracking-widest uppercase font-sans">GRABANDO VIDEO DE EVIDENCIA</span>
                      </div>
                    )}
                  </div>

                  {/* Control bar */}
                  <div className="p-6 bg-slate-950/40 border-t border-slate-800/60 space-y-4">
                    {/* Mode switch */}
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        disabled={isCameraRecording}
                        onClick={() => setCameraMode('photo')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer font-sans",
                          cameraMode === 'photo' 
                            ? "bg-emerald-500 text-white shadow-sm font-black" 
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                        )}
                      >
                        FOTOGRAFÍA
                      </button>
                      <button
                        type="button"
                        disabled={isCameraRecording}
                        onClick={() => setCameraMode('video')}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer font-sans",
                          cameraMode === 'video' 
                            ? "bg-emerald-500 text-white shadow-sm font-black" 
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                        )}
                      >
                        GRABACIÓN VIDEO
                      </button>
                    </div>

                    {/* Capture Trigger */}
                    <div className="flex items-center justify-center gap-6">
                      {cameraDevices.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const currentIdx = cameraDevices.findIndex(d => d.deviceId === selectedCameraId);
                            const nextIdx = (currentIdx + 1) % cameraDevices.length;
                            const nextCam = cameraDevices[nextIdx];
                            setSelectedCameraId(nextCam.deviceId);
                            startCamera(cameraTarget, nextCam.deviceId);
                          }}
                          className="p-3 bg-slate-805 hover:bg-slate-705 text-slate-300 rounded-2xl transition-all cursor-pointer border border-slate-800"
                          title="Cambiar Cámara"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}

                      {cameraMode === 'photo' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const videoElement = document.querySelector('video');
                            capturePhotoFromCamera(videoElement);
                          }}
                          className="w-14 h-14 bg-white hover:bg-slate-105 rounded-full border-4 border-slate-750 cursor-pointer flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                          title="Capturar Foto"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-300" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={isCameraRecording ? stopVideoRecordingFromCamera : startVideoRecordingFromCamera}
                          className={cn(
                            "w-14 h-14 rounded-full border-4 cursor-pointer flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95",
                            isCameraRecording 
                              ? "bg-red-500 border-red-700 animate-pulse" 
                              : "bg-white border-slate-700 hover:bg-slate-105"
                          )}
                          title={isCameraRecording ? "Detener Grabación" : "Grabar Video"}
                        >
                          {isCameraRecording ? (
                            <div className="w-4 h-4 bg-white rounded-none" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-red-500" />
                          )}
                        </button>
                      )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
       </div>
    </div>
  );
}
