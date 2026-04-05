import React from 'react';
import CabinetElevationFront from '../components/CabinetElevationFront';

export default function RealisticFacadeViewer({ cabinet, projectName }) {
  if (!cabinet) {
    return (
      <div className="w-full h-[750px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-medium">Aucune donnée de façade</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[750px] bg-gradient-to-b from-[#f8f9fa] to-[#e9ecef] rounded-2xl overflow-hidden shadow-2xl relative flex items-center justify-center">
      
      {/* Simulation mur + sol + plinthe */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-[85%] bg-gradient-to-b from-[#fafbfc] to-[#f1f3f5]"></div>
        <div className="absolute bottom-0 left-0 right-0 h-[15%] bg-gradient-to-b from-[#e9ecef] to-[#dee2e6]"></div>
        <div className="absolute bottom-[15%] left-0 right-0 h-2 bg-white shadow-sm"></div>
        {/* Ombre portée du meuble sur le mur */}
        <div className="absolute top-[10%] left-[15%] right-[15%] bottom-[20%] bg-black/5 blur-3xl rounded-3xl"></div>
      </div>

      {/* Cadre "photo réaliste" avec le SVG directement rendu */}
      <div className="relative z-10 w-[92%] max-w-[1100px] bg-white rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.12)] overflow-hidden border border-gray-200 p-4">
        <CabinetElevationFront cabinet={cabinet} name={projectName || 'Meuble'} />
      </div>

      {/* UI Overlay */}
      <div className="absolute top-5 left-5 bg-white/95 backdrop-blur px-5 py-3 rounded-xl shadow-md border border-gray-100 z-20">
        <div className="text-sm font-bold text-gray-800">📐 Vue Réaliste Client</div>
        <div className="text-xs text-gray-500 mt-1">Basée sur votre croquis • Rendu instantané</div>
      </div>

      <div className="absolute bottom-5 right-5 bg-white/95 backdrop-blur px-4 py-2 rounded-lg shadow-md border border-gray-100 text-xs text-gray-600 z-20">
        Format prêt pour impression / WhatsApp
      </div>
    </div>
  );
}