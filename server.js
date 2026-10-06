const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Serve static frontend files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory store: Map<PIN, { content: string, expiresAt: number }>
const storage = new Map();

// Helper: Generate a unique 4-digit PIN
function generateUniquePin() {
  let pin;
  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
  } while (storage.has(pin));
  return pin;
}

// Background cleanup: Runs every 60 seconds to delete expired notes
setInterval(() => {
  const now = Date.now();
  for (const [pin, item] of storage.entries()) {
    if (now > item.expiresAt) {
      storage.delete(pin);
    }
  }
}, 60 * 1000);

// API Endpoint 1: Save note and return a 4-digit PIN
app.post('/api/share', (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'Text content cannot be empty.' });
  }

  // 15-minute expiration
  const TTL_MS = 15 * 60 * 1000;
  const pin = generateUniquePin();

  storage.set(pin, {
    content: text,
    expiresAt: Date.now() + TTL_MS,
  });

  res.json({
    pin,
    expiresInMinutes: 15,
  });
});

// API Endpoint 2: Retrieve note using the 4-digit PIN
app.get('/api/retrieve/:pin', (req, res) => {
  const { pin } = req.params;

  if (!storage.has(pin)) {
    return res.status(404).json({ error: 'Invalid or expired PIN.' });
  }

  const record = storage.get(pin);

  // Guard against expired items that haven't been swept by interval yet
  if (Date.now() > record.expiresAt) {
    storage.delete(pin);
    return res.status(404).json({ error: 'This note has expired.' });
  }

  const minutesRemaining = Math.max(
    1,
    Math.ceil((record.expiresAt - Date.now()) / (60 * 1000))
  );

  res.json({
    content: record.content,
    expiresInMinutes: minutesRemaining,
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});