export const STORAGE_SCHEMA_VERSION = 3;

/**
 * Migrate a stored project object to the current schema version.
 * Returns a valid object on success, or null if the input is corrupted.
 */
export function migrateStoredProject(stored) {
  try {
    let project = { ...stored };
    const version = project._schemaVersion;

    // v0 → v1 : add fields introduced in schema v1
    if (version === undefined || version < 1) {
      console.warn('[migrations] Migrating project from v0 → v1');
      if (project.grainDirection === undefined) project.grainDirection = null;
      if (project.edgeType === undefined) project.edgeType = null;
      if (project.supplierRef === undefined) project.supplierRef = null;
      if (project.scanMode === undefined) project.scanMode = 'full';
      project._schemaVersion = 1;
    }

    // v1 → v2 : add fields introduced in schema v2
    if (project._schemaVersion < 2) {
      console.warn('[migrations] Migrating project from v1 → v2');
      if (project.sketchDraft === undefined) project.sketchDraft = null;
      if (project.cabinet === undefined) project.cabinet = null;
      project._schemaVersion = 2;
    }

    // v2 → v3 : add panel field introduced in schema v3
    if (project._schemaVersion < 3) {
      console.warn('[migrations] Migrating project from v2 → v3');
      if (project.panel === undefined || project.panel === null) {
        project.panel = { w: 244, h: 122, thickness: 1.8, label: 'MDF 18mm' };
      }
      project._schemaVersion = 3;
    }

    return project;
  } catch (err) {
    console.warn('[migrations] Could not migrate stored project, resetting to default:', err);
    return null;
  }
}
