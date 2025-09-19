const express = require('express');
const { compileLatex } = require('./lib/latex');

const router = express.Router();

router.post('/compile', async (req, res) => {
  try {
  const { code, format = 'svg', engine = 'lualatex', formats } = req.body || {};
    if (typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ error: 'Missing LaTeX code' });
    }

    const fmtArray = Array.isArray(formats) && formats.length > 0
      ? Array.from(new Set(formats))
      : (format ? [format] : ['svg']);

  const result = await compileLatex({ code, formats: fmtArray, engine });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Compilation failed', detail: String(err && err.message || err) });
  }
});

module.exports = router;
