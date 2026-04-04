import React, { useState, useRef } from 'react';
import { Upload, X, FileImage, CheckCircle, AlertCircle } from 'lucide-react';

export default function ImageUpload({ onScanComplete, onCancel }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleFile = (f) => {
    if (!f.type.startsWith('image/')) {
      setError('Seuls les fichiers images sont acceptés (JPG, PNG).');
      return;
    }
    setFile(f);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleScan = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);

    try {
      const base64Image = preview.split(',')[1];

      const response = await fetch('https://panelcut-server.vercel.app/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image, mediaType: file.type }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Erreur lors de l'analyse");
      }

      const data = await response.json();
      console.log('SCAN RESULT:', JSON.stringify(data, null, 2));

      // ✅ FIX : on transmet l'image base64 complète (avec header data:image/...)
      // pour que ScanWithEditor → SketchEditor puisse l'afficher
      onScanComplete(data, preview);

    } catch (err) {
      console.error(err);
      setError('Échec de la connexion au serveur. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden relative">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileImage className="w-6 h-6 text-blue-600" />
            Analyser un nouveau plan
          </h2>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {!preview ? (
            <div
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                dragActive ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={handleChange} />
              <div className="flex flex-col items-center gap-4 cursor-pointer" onClick={() => inputRef.current?.click()}>
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <Upload className="w-10 h-10 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-700">Glissez votre plan ici</p>
                  <p className="text-slate-500 mt-1">ou cliquez pour parcourir (JPG, PNG)</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center">
                <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                <button
                  onClick={() => { setFile(null); setPreview(null); setError(null); }}
                  className="absolute top-2 right-2 bg-white/90 p-2 rounded-full shadow hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleScan}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Analyse en cours...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Lancer l'analyse IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
