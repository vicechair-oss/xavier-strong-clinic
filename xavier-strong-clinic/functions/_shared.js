/**
 * Shared helpers for Xavier Strong Clinic registration functions.
 * Runs on Cloudflare Pages Functions (Workers runtime).
 */

export const FEE_CENTS = 2000;          // $20.00, fixed server-side. Never trust the client.
export const FEE_USD = '20.00';
export const CLINIC_DATE = '2026-10-09';

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

/** Trim, collapse whitespace, and cap length so nothing oversized reaches Airtable. */
export function clean(v, max = 500) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Digits only, 10 or 11 (US). Returns '' when it doesn't look like a phone. */
export function normalizePhone(v) {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return '';
}

export function formatPhone(d) {
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d;
}

/** XS-<first 3 letters of player name>-<4 digits>. Human-readable in a Venmo note. */
export function makeReference(playerName) {
  const letters = String(playerName || '').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'XSC';
  const n = Math.floor(1000 + Math.random() * 9000);
  return `XS-${letters}-${n}`;
}

/* ---------------------------------------------------------------- Airtable */

/** Trim env vars: a trailing space pasted into a dashboard is invisible and fatal. */
const envStr = (v, fallback = '') => String(v ?? fallback).trim();

function airtableUrl(env, path = '') {
  const base  = envStr(env.AIRTABLE_BASE_ID);
  const table = encodeURIComponent(envStr(env.AIRTABLE_TABLE, 'Registrations'));
  return `https://api.airtable.com/v0/${base}/${table}${path}`;
}

/** Describes config without exposing secrets, for log output only. */
export function configFingerprint(env) {
  const tok = envStr(env.AIRTABLE_TOKEN);
  return {
    baseId: envStr(env.AIRTABLE_BASE_ID),
    table: envStr(env.AIRTABLE_TABLE, 'Registrations'),
    tokenLength: tok.length,
    tokenPrefix: tok.slice(0, 7),
    tokenHasDot: tok.includes('.'),
    rawBaseIdLength: String(env.AIRTABLE_BASE_ID ?? '').length,
    rawTableLength: String(env.AIRTABLE_TABLE ?? '').length,
  };
}

export async function airtableCreate(env, fields) {
  const res = await fetch(airtableUrl(env), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${envStr(env.AIRTABLE_TOKEN)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) {
    console.error('AIRTABLE CONFIG', JSON.stringify(configFingerprint(env)));
    console.error('AIRTABLE URL', airtableUrl(env));
    throw new Error(`Airtable create failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function airtableUpdate(env, recordId, fields) {
  const res = await fetch(airtableUrl(env, `/${recordId}`), {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${envStr(env.AIRTABLE_TOKEN)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) {
    throw new Error(`Airtable update failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Look up a record by its Reference code. Used to reconcile a payment to a registration. */
export async function airtableFindByReference(env, reference) {
  const formula = encodeURIComponent(`{Reference}="${reference.replace(/"/g, '')}"`);
  const res = await fetch(airtableUrl(env, `?filterByFormula=${formula}&maxRecords=1`), {
    headers: { authorization: `Bearer ${envStr(env.AIRTABLE_TOKEN)}` },
  });
  if (!res.ok) throw new Error(`Airtable lookup failed (${res.status})`);
  const data = await res.json();
  return data.records?.[0] || null;
}

/* ------------------------------------------------------------------ PayPal */

export function paypalBase(env) {
  return env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export async function paypalToken(env) {
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`);
  const res = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}
