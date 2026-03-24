import React from 'react';
import ProjectsScreen from './components/ProjectsScreen';

function App() {
  // Fonctions factices pour l'instant (à connecter plus tard)
  const handleLoadProject = (id) => {
    console.log("Charger projet:", id);
    alert("Ouverture du projet " + id);
  };

  const handleNewProject = () => {
    console.log("Nouveau projet");
    alert("Création d'un nouveau projet");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 
         On passe user={null} car ProjectsScreen gère sa propre auth interne 
         ou on la corrigera dans ProjectsScreen si besoin.
         L'important maintenant : voir le design !
      */}
      <ProjectsScreen 
        user={null} 
        onLoad={handleLoadProject} 
        onNew={handleNewProject} 
      />
    </div>
  );
}

export default App;
