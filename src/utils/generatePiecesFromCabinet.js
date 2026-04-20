/**
 * Génère la liste des pièces bois depuis un cabinet édité localement,
 * sans appel serveur.
 *
 * @param {Object} cabinet
 *   { width, height, depth, plinth, thickness, modules[] }
 *   Chaque module : { width, shelves, drawerItems, drawers, drawerParts, hasBack }
 * @param {number} panelThickness  Épaisseur panneau en cm (ex : 1.8)
 * @returns {Array<{name: string, length: number, height: number, qty: number}>}
 */
export function generatePiecesFromCabinet(cabinet, panelThickness) {
  const t  = Number(panelThickness) || Number(cabinet.thickness) || 1.8;
  const W  = Number(cabinet.width)  || 0;
  const H  = Number(cabinet.height) || 0;
  const D  = Number(cabinet.depth)  || 60;
  const pl = Number(cabinet.plinth) || 0;
  const modules = Array.isArray(cabinet.modules) ? cabinet.modules : [];
  const n = modules.length;

  const pieces = [];

  /** Ajoute ou regroupe une pièce (même nom + mêmes dimensions → qty cumulée). */
  const add = (name, length, height, qty = 1) => {
    const l = Math.round(length * 10) / 10;
    const h = Math.round(height * 10) / 10;
    if (l <= 0 || h <= 0 || qty <= 0) return;
    const existing = pieces.find(p => p.name === name && p.length === l && p.height === h);
    if (existing) {
      existing.qty += qty;
    } else {
      pieces.push({ name, length: l, height: h, qty });
    }
  };

  // 1. Panneaux latéraux (x2) — h = hauteur totale - plinthe, l = profondeur
  add('Panneau latéral', D, H - pl, 2);

  // 2. Panneau dessus — l = largeur totale, h = profondeur
  add('Panneau dessus', W, D, 1);

  // 3. Panneau fond bas (par module) — l = largeur module, h = profondeur
  for (const mod of modules) {
    add('Panneau fond bas', mod.width, D, 1);
  }

  // 4. Séparateurs verticaux (nb_modules - 1)
  //    h = hauteur - plinthe - épaisseur dessus - épaisseur fond bas
  if (n > 1) {
    const sepH = H - pl - t - t;
    add('Séparateur vertical', D, sepH, n - 1);
  }

  // 5. Tablettes (par tablette dans chaque module)
  //    l = largeur module - 2*épaisseur, h = profondeur - 2 cm (recul)
  for (const mod of modules) {
    const shelfCount = Array.isArray(mod.shelves)
      ? mod.shelves.length
      : (Number(mod.shelves) || 0);
    if (shelfCount > 0) {
      add('Tablette', mod.width - 2 * t, D - 2, shelfCount);
    }
  }

  // 6-7. Tiroirs (par tiroir dans chaque module)
  for (const mod of modules) {
    const drawerParts = mod.drawerParts || {};
    const drawerItems = Array.isArray(mod.drawerItems) ? mod.drawerItems : [];
    const drawerCount = drawerItems.length > 0
      ? drawerItems.length
      : (Number(mod.drawers) || 0);

    if (drawerCount === 0) continue;

    // 6. Fond de tiroir (si drawerParts.bottom) — l = largeur - 2t - 1 cm, h = profondeur - 2 cm
    if (drawerParts.bottom !== false) {
      add('Fond de tiroir', mod.width - 2 * t - 1, D - 2, drawerCount);
    }

    // 7. Façade tiroir (si drawerParts.front) — l = largeur - 0.3 cm, h = hauteur tiroir - 0.2 cm
    if (drawerParts.front !== false) {
      if (drawerItems.length > 0) {
        for (const di of drawerItems) {
          const drawerH = Number(di.height ?? di.h ?? 18);
          add('Façade tiroir', mod.width - 0.3, drawerH - 0.2, 1);
        }
      } else {
        // Hauteurs individuelles inconnues : hauteur par défaut 18 cm
        add('Façade tiroir', mod.width - 0.3, 18 - 0.2, drawerCount);
      }
    }
  }

  // 8. Dos armoire — généré uniquement si au moins un module a un fond (hasBack !== false)
  //    l = largeur totale - 2*épaisseur, h = hauteur - plinthe - épaisseur dessus
  const hasAnyBack = modules.some(m => m.hasBack !== false);
  if (hasAnyBack) {
    add('Dos armoire', W - 2 * t, H - pl - t, 1);
  }

  return pieces;
}
