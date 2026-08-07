export function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint not found', path: req.path });
}

export function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}
