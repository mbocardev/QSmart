// src/lib/utils/token.ts
// Génération et validation des jetons QR anti-triche
// Basé sur TOTP (Time-based One-Time Password) — RFC 6238

import { authenticator } from 'otplib';

// Fenêtre de validité : 35 secondes (2 périodes de 15s + marge réseau)
const STEP_SECONDS = 15;
const WINDOW = 2; // accepte T-1, T, T+1

authenticator.options = {
  step: STEP_SECONDS,
  window: WINDOW,
  digits: 8
};

/**
 * Génère un jeton QR pour un commerce donné.
 * Le jeton change automatiquement toutes les 15 secondes.
 * Le payload encodé dans le QR code est : base64(commerce_id:token)
 */
export function genererTokenQR(commerceId: string, cleSecrete: string): string {
  const token = authenticator.generate(cleSecrete);
  const payload = `${commerceId}:${token}`;
  return btoa(payload);
}

/**
 * Valide un jeton QR reçu du client.
 * Retourne { valide: true, commerceId } ou { valide: false, raison }
 */
export function validerTokenQR(
  tokenBase64: string,
  cleSecrete: string
): { valide: true; commerceId: string } | { valide: false; raison: string } {
  try {
    const decoded = atob(tokenBase64);
    const [commerceId, token] = decoded.split(':');

    if (!commerceId || !token) {
      return { valide: false, raison: 'Format de jeton invalide.' };
    }

    const isValid = authenticator.verify({ token, secret: cleSecrete });

    if (!isValid) {
      return {
        valide: false,
        raison: 'Code expiré. Scannez le QR code directement sur place.'
      };
    }

    return { valide: true, commerceId };
  } catch {
    return { valide: false, raison: 'Jeton illisible.' };
  }
}

/**
 * Durée restante (ms) avant le prochain renouvellement du QR code.
 * Utilisé pour l'animation de progression sur le kiosque.
 */
export function tempsRestantQR(): number {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now % STEP_SECONDS;
  return (STEP_SECONDS - elapsed) * 1000;
}

/**
 * Pourcentage de vie restant du QR code courant (0–100).
 */
export function pourcentageRestant(): number {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now % STEP_SECONDS;
  return Math.round(((STEP_SECONDS - elapsed) / STEP_SECONDS) * 100);
}
