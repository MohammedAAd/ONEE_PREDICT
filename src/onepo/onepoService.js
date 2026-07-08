// ============================================================
// Connecteur webhook ONEPO AI  ->  n8n
// URL configurable · timeout · retry · fallback gracieux
// ============================================================

// Priorité : surcharge runtime (window) > variable d'env Vite > défaut dev.
const WEBHOOK_URL =
  (typeof window !== 'undefined' && window.ONEPO_WEBHOOK_URL) ||
  import.meta.env.VITE_ONEPO_WEBHOOK_URL ||
  'http://localhost:5678/webhook/onepo-ai';

const TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;

export function genId() {
  return 'conv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// n8n ("Respond to Webhook") renvoie des formes variées -> on normalise.
function normaliser(data) {
  const d = Array.isArray(data) ? (data[0] || {}) : (data || {});
  const reply = d.reply || d.output || d.text || d.answer || d.message ||
    (typeof d === 'string' ? d : null);
  return {
    reply: reply ? String(reply) : 'Réponse reçue mais vide.',
    suggestions: Array.isArray(d.suggestions) ? d.suggestions : [],
    actions: Array.isArray(d.actions) ? d.actions : [],
    erreur: false,
  };
}

// Envoie { message, context, conversation_id } au webhook n8n.
export async function envoyerMessage({ message, context, conversationId }) {
  const payload = { message, conversation_id: conversationId, context,
                    timestamp: new Date().toISOString() };

  let derniereErreur;
  for (let essai = 0; essai <= MAX_RETRIES; essai++) {
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(minuteur);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json().catch(() => ({}));
      return normaliser(data);
    } catch (e) {
      clearTimeout(minuteur);
      derniereErreur = e;
      if (essai < MAX_RETRIES) await new Promise(res => setTimeout(res, 600 * (essai + 1)));
    }
  }

  const cause = derniereErreur && derniereErreur.name === 'AbortError'
    ? "le délai d'attente a été dépassé"
    : (derniereErreur ? derniereErreur.message : 'erreur inconnue');
  return {
    reply: "Je n'ai pas pu joindre l'agent IA (n8n) — " + cause + ".\n\n" +
      "Vérifiez que le workflow n8n est **actif** et que l'URL du webhook " +
      "(`VITE_ONEPO_WEBHOOK_URL`) est correcte.",
    suggestions: [], actions: [], erreur: true,
  };
}