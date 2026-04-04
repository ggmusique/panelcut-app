import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── Prompt Claude Vision — format JSON structuré avec positions ────────────
const VISION_PROMPT = `Tu es un expert en ébénisterie et menuiserie. Analyse cette image d'un meuble et retourne UNIQUEMENT un objet JSON valide (sans markdown, sans \`\`\`json) avec cette structure exacte :

{
  "width": <largeur totale du meuble en cm>,
  "height": <hauteur totale du meuble en cm>,
  "depth": <profondeur estimée en cm>,
  "plinth": <hauteur du socle/plinthe en cm, 0 si absent>,
  "thickness": 3,
  "modules": [
    {
      "x_start": <position X du bord gauche intérieur depuis le bord gauche du meuble en cm>,
      "width": <largeur intérieure nette du module en cm>,
      "shelves": [ { "y": <hauteur de la tablette depuis le bas intérieur du module en cm> } ],
      "drawers": [ { "y": <hauteur du bas du tiroir depuis le bas intérieur en cm>, "height": <hauteur du tiroir en cm> } ],
      "rod": { "y": <hauteur de la tringle depuis le bas intérieur en cm> } ou null,
      "doors": <nombre de portes dans ce module>
    }
  ]
}

Règles strictes :
- thickness = 3 (panneaux structurels de 30 mm, toujours)
- x_start du premier module = 3 (épaisseur du panneau côté gauche)
- x_start de chaque module suivant = x_start précédent + width précédent + 3
- Les positions y sont mesurées depuis le bas intérieur du meuble (au-dessus du fond bas)
- Si un élément est absent : shelves = [], drawers = [], rod = null
- Retourne UNIQUEMENT le JSON brut, sans aucun texte autour.`;

const Scanner = ({ onComplete, onClose }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState('capture');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [detectedPieces, setDetectedPieces] = useState([]);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Nettoyer la caméra si la modale se ferme
  useEffect(() => {
    return () => stopCamera();
  }, [onClose]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Erreur caméra:", err);
      setError(t('scanner.camera_error') || "Erreur d'accès à la caméra");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          processFile(blob);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(file);
      setPreview(e.target.result);
      setStep('review');
    };
    reader.readAsDataURL(file);
  };

  // Fonction de pré-traitement pour améliorer la détection IA
  const preprocessImageForAI = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Dessiner l'image originale
        ctx.drawImage(img, 0, 0);
        
        // Appliquer un filtre noir et blanc + contraste
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          // Moyenne RGB pour le niveau de gris
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          
          // Augmenter le contraste (facteur 1.2)
          const contrasted = 128 + (avg - 128) * 1.2;
          
          // Appliquer aux 3 canaux
          data[i] = contrasted;     // R
          data[i + 1] = contrasted; // G
          data[i + 2] = contrasted; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    });
  };

  const handleConfirm = async () => {
    if (!preview) return;

    setIsProcessing(true);
    setStep('processing');
    setError(null);

    try {
      // 1. Pré-traiter l'image pour l'IA
      const processedImageBase64 = await preprocessImageForAI(preview);
      
      // Extraire le base64 pur (sans le header data:image/jpeg;base64,)
      const base64Data = processedImageBase64.split(',')[1];
      const mediaType = 'image/jpeg';

      const formData = new FormData();
      formData.append('image', base64Data);
      formData.append('mediaType', mediaType);
      formData.append('prompt', VISION_PROMPT);

      const apiUrl = 'https://panelcut-server.vercel.app/api/scan';
      console.log("Envoi du scan vers:", apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erreur serveur:", response.status, errorData);
        throw new Error(errorData.error || t('scanner.upload_failed'));
      }

      const data = await response.json();
      console.log("Réception du scan:", data);

      if (data.pieces) {
        setDetectedPieces(data.pieces);
      } else {
        setDetectedPieces([{ id: 1, name: t('scanner.detected_part'), width: 100, height: 200, quantity: 1 }]);
      }

      setStep('done');
      
      setTimeout(() => {
        if (onComplete) {
          onComplete({
            image: preview, // On renvoie l'image originale pour l'affichage
            pieces: detectedPieces.length > 0 ? detectedPieces : [{ id: 1, name: t('scanner.detected_part'), width: 100, height: 200, quantity: 1 }],
            cabinet: data.cabinet
          });
        }
      }, 1000);

    } catch (err) {
      console.error("Échec du scan:", err);
      setError(err.message || t('scanner.upload_failed'));
      setStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScan = () => {
    setImage(null);
    setPreview(null);
    setStep('capture');
    setError(null);
    setDetectedPieces([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl relative">
        
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {t('scanner.title')}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 min-h-[300px] flex flex-col items-center justify-center">
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2 text-sm w-full">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {step === 'capture' && (
            <div className="w-full flex flex-col items-center gap-4">
              <div className="relative w-full h-64 bg-gray-900 rounded-lg overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-lg m-4 pointer-events-none"></div>
              </div>
              
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center justify-center gap-2"
                >
                  <Upload size={20} />
                  {t('scanner.upload_photo')}
                </button>
                <button
                  onClick={handleCapture}
                  className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  {t('scanner.take_photo')}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {step === 'review' && preview && (
            <div className="w-full flex flex-col items-center gap-4">
              <img src={preview} alt="Preview" className="w-full h-64 object-contain rounded-lg bg-gray-100 dark:bg-gray-900" />
              <div className="flex gap-4 w-full">
                <button
                  onClick={resetScan}
                  className="flex-1 py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                  {t('common.retry')}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                  {isProcessing ? t('scanner.processing') : t('common.confirm')}
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-10">
              <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={48} />
              <p className="text-gray-600 dark:text-gray-300 font-medium">{t('scanner.analyzing')}</p>
              <p className="text-sm text-gray-500 mt-2">{t('scanner.please_wait')}</p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('scanner.success')}</h4>
              <p className="text-gray-600 dark:text-gray-300">
                {t('scanner.parts_detected', { count: detectedPieces.length })}
              </p>
              <p className="text-sm text-gray-500 mt-4">{t('scanner.redirecting')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scanner;
