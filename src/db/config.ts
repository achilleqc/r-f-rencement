/**
 * Connexion à la base : lue depuis l'environnement, sans ouvrir de connexion
 * (importable partout, y compris pour vérifier la configuration).
 */

/**
 * Cherche une variable d'environnement par son nom exact, ou par suffixe : l'intégration
 * Turso de Vercel peut ajouter un préfixe (ex. « PROSPECTION_TURSO_DATABASE_URL »).
 */
function findEnv(...suffixes: string[]) {
  for (const suffix of suffixes) {
    if (process.env[suffix]) return process.env[suffix];
  }
  for (const suffix of suffixes) {
    const key = Object.keys(process.env).find((k) => k.toUpperCase().endsWith(suffix) && process.env[k]);
    if (key) return process.env[key];
  }
  return undefined;
}

/** URL de la base : DATABASE_URL, ou les variables créées par l'intégration Turso de Vercel. */
export function databaseUrl() {
  return process.env.DATABASE_URL || findEnv("TURSO_DATABASE_URL", "TURSO_URL", "LIBSQL_URL") || "file:./data/app.db";
}

export function databaseAuthToken() {
  return process.env.DATABASE_AUTH_TOKEN || findEnv("TURSO_AUTH_TOKEN", "TURSO_TOKEN", "LIBSQL_AUTH_TOKEN") || undefined;
}

/** Sur Vercel, un fichier SQLite ne survit pas : il faut une base en ligne (Turso). */
export function databaseMissingOnVercel() {
  return Boolean(process.env.VERCEL) && databaseUrl().startsWith("file:");
}
