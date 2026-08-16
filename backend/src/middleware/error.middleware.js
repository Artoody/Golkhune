function notFound(_req, res) {
  res.status(404).json({ ok: false, error: "Not found" });
}

function errorHandler(err, _req, res, _next) {
  console.error("[HTTP] Unhandled error:", err.message);
  res.status(500).json({ ok: false, error: "Internal server error" });
}

module.exports = { notFound, errorHandler };
