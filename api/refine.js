const MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 20000;

const SYSTEM_PROMPT = `Tu es un expert en analyse de croquis d'armoires et de meubles.
À partir de l'image fournie (croquis annoté avec corrections), retourne UNIQUEMENT un objet JSON valide.
Format attendu :
{
  "cabinet": {
    "width": <number cm>,
    "height": <number cm>,
    "depth": <number cm>,
    "plinth": <number cm>,
    "thickness": <number cm>,
    "nb_shelves": <number>,
    "nb_drawers": <number>,
    "nb_dividers": <number>,
    "modules": []
  },
  "pieces": [
    { "label": "<nom>", "qty": <number>, "w": <number cm>, "h": <number cm>, "material": "<matière>" }
  ]
}
Ne retourne aucun texte en dehors du JSON.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    if (!req.body) {
      console.error('REFINE: missing body');
      return res.status(400).json({ error: 'invalid_input', detail: 'missing body' });
    }

    const { image, mediaType, prompt, context, pieces, userNotes } = req.body;

    console.log('🛠️ REFINE BODY:', JSON.stringify(req.body).slice(0, 300));

    if (!image || typeof image !== 'string') {
      console.error('REFINE: missing or invalid image field');
      return res.status(400).json({ error: 'invalid_input', detail: 'image field required' });
    }

    if (pieces !== undefined && !Array.isArray(pieces)) {
      console.error('REFINE: pieces is not an array');
      return res.status(400).json({ error: 'invalid_input', detail: 'pieces must be an array' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('REFINE: ANTHROPIC_API_KEY not set');
      return res.status(500).json({ error: 'server_misconfiguration', detail: 'API key missing' });
    }

    // ✅ FIX IMAGE BASE64
    const cleanImage = image.replace(/^data:image\/\w+;base64,/, '');

    console.log('IMAGE LENGTH:', image.length);
    console.log('CLEAN IMAGE LENGTH:', cleanImage.length);

    const resolvedMediaType = mediaType || 'image/jpeg';
    const userPromptText = prompt || userNotes || 'Analyse ce croquis et retourne le JSON des pièces.';

    const contextNote = context
      ? `\n\nContexte initial (scan précédent) :\n${JSON.stringify(context).slice(0, 1000)}`
      : '';

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: resolvedMediaType,
              data: cleanImage, // ✅ FIX ICI
            },
          },
          {
            type: 'text',
            text: userPromptText + contextNote,
          },
        ],
      },
    ];

    console.log('REFINE MODEL:', MODEL);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024, // ✅ réduit (seul changement ici)
          system: SYSTEM_PROMPT,
          messages,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const raw = await response.text();
      console.error('REFINE API ERROR:', raw);
      return res.status(502).json({
        error: 'api_error',
        status: response.status,
        detail: raw.slice(0, 500),
      });
    }

    const apiData = await response.json();
    console.log('REFINE API OK, stop_reason:', apiData.stop_reason);

    const rawText = apiData?.content?.[0]?.text || '';
    if (!rawText) {
      console.error('REFINE: empty content from API', JSON.stringify(apiData).slice(0, 300));
      return res.status(502).json({ error: 'empty_response', detail: 'Claude returned no content' });
    }

    let parsed;
    try {
      let jsonStr = rawText.trim();
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else if (!jsonStr.startsWith('{')) {
        const start = jsonStr.indexOf('{');
        if (start !== -1) jsonStr = jsonStr.slice(start);
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('REFINE: JSON parse error:', parseErr.message, '| raw:', rawText.slice(0, 300));
      return res.status(502).json({
        error: 'parse_error',
        detail: 'Claude response could not be parsed as JSON',
        raw: rawText.slice(0, 500),
      });
    }

    return res.status(200).json({ result: parsed });

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('REFINE: request timed out after', TIMEOUT_MS, 'ms');
      return res.status(504).json({ error: 'timeout', detail: 'Claude API timed out' });
    }
    console.error('REFINE UNEXPECTED ERROR:', err.message, err.stack);
    return res.status(500).json({ error: 'server_error', detail: err.message });
  }
}
