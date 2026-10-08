export function notFound(_req, res, _next) {
  res.status(404).json({ error: "Not Found" });
}

export function errorHandler(err, _req, res, _next) {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "Image trop lourde (5 Mo maximum)" });
  }
  if (err.name === "MulterError") {
    return res.status(400).json({ error: "Envoi du fichier impossible" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Requete JSON invalide" });
  }
  if (err.code === "23505") {
    return res.status(409).json({ error: "Cet element existe deja" });
  }
  if (err.code === "22P02") {
    return res.status(400).json({ error: "Identifiant invalide" });
  }

  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status >= 500 ? "Erreur interne du serveur" : err.message || "Erreur",
  });
}
