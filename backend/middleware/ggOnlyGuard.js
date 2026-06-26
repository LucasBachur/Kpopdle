const { getGgOnlyMode } = require('../db');

// Blocks Boy-Group-scoped requests while GG-only launch mode is enabled.
//
// Gender is resolved from the request in priority order: route params →
// body → query (first defined wins), defaulting to 'gg' when none is present.
// Only an explicit 'bg' is gated; 'gg' and any unknown value pass through so
// the handler can perform its own enum validation (returning 400, not 403).
//
// This is the authoritative trust boundary. Frontend hiding is UX-only.
async function ggOnlyGuard(req, res, next) {
  const gender =
    req.params?.genderCategory ??
    req.body?.genderCategory ??
    req.query?.genderCategory ??
    'gg';

  if (gender !== 'bg') return next();

  try {
    if (await getGgOnlyMode()) {
      return res.status(403).json({ error: 'Boy Group content is not available.' });
    }
    return next();
  } catch (err) {
    console.error('ggOnlyGuard:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { ggOnlyGuard };
