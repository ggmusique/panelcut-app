import React from 'react';
import ProfessionalRealisticViewer from './ProfessionalRealisticViewer';

/**
 * RealisticFacadeViewer — wrapper vers le vrai moteur 3D réaliste.
 * Précédemment pointait par erreur vers CabinetElevationFront (SVG croquis).
 */
export default function RealisticFacadeViewer({ cabinet, projectName, name }) {
  const displayName = projectName || name || 'Meuble';

  if (!cabinet) {
    return (
      <div className="w-full h-[750px] flex items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-medium">Aucune donnée de façade disponible</p>
          <p className="text-sm mt-1 text-gray-400">Lancez un scan IA ou saisissez les dimensions</p>
        </div>
      </div>
    );
  }

  return (
    <ProfessionalRealisticViewer
      cabinet={cabinet}
      name={displayName}
    />
  );
}
