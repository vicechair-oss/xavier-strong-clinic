/**
 * POST /api/register
 * Validates a registration, writes it to Airtable as Unpaid, returns the reference code.
 * Path-independent: runs the same whether payment is Pay-with-Venmo or a Venmo handoff.
 */
import {
  json, bad, clean, isEmail, normalizePhone, formatPhone,
  makeReference, airtableCreate, CLINIC_DATE,
} from '../_shared.js';

const SHIRTS = ['Youth S','Youth M','Youth L','Youth XL',
                'Adult S','Adult M','Adult L','Adult XL','Adult XXL'];

function ageOnClinicDay(dobStr) {
  const dob = new Date(dobStr + 'T00:00:00Z');
  const day = new Date(CLINIC_DATE + 'T00:00:00Z');
  if (isNaN(dob)) return null;
  let age = day.getUTCFullYear() - dob.getUTCFullYear();
  const m = day.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && day.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed request.');
  }

  // Honeypot: real people never fill this, bots usually do.
  if (clean(body.website)) return json({ ok: true, reference: 'XS-000-0000' });

  const guardianName  = clean(body.guardianName, 120);
  const guardianEmail = clean(body.guardianEmail, 160).toLowerCase();
  const guardianPhone = normalizePhone(body.guardianPhone);
  const playerName    = clean(body.playerName, 120);
  const dob           = clean(body.dob, 20);
  const grade         = clean(body.grade, 20);
  const shirt         = clean(body.shirt, 20);
  const position      = clean(body.position, 40);
  const emergName     = clean(body.emergencyName, 120);
  const emergPhone    = normalizePhone(body.emergencyPhone);
  const allergies     = clean(body.allergies, 2000);
  const notes         = clean(body.notes, 2000);
  const consent       = body.consent === true;

  const errors = {};
  if (!guardianName)             errors.guardianName = 'Required.';
  if (!isEmail(guardianEmail))   errors.guardianEmail = 'Enter a valid email.';
  if (!guardianPhone)            errors.guardianPhone = 'Enter a 10-digit US phone number.';
  if (!playerName)               errors.playerName = 'Required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.dob = 'Required.';
  if (!SHIRTS.includes(shirt))   errors.shirt = 'Choose a shirt size.';
  if (!emergName)                errors.emergencyName = 'Required.';
  if (!emergPhone)               errors.emergencyPhone = 'Enter a 10-digit US phone number.';
  if (!consent)                  errors.consent = 'Consent is required to register.';

  const age = dob ? ageOnClinicDay(dob) : null;
  if (age !== null && (age < 4 || age > 25)) {
    errors.dob = 'Check the date of birth.';
  }

  if (Object.keys(errors).length) {
    return json({ ok: false, errors }, 422);
  }

  const reference = makeReference(playerName);

  const fields = {
    'Reference':          reference,
    'Player Name':        playerName,
    'Date of Birth':      dob,
    'Grade':              grade || undefined,
    'T-Shirt Size':       shirt,
    'Position':           position || undefined,
    'Guardian Name':      guardianName,
    'Guardian Email':     guardianEmail,
    'Guardian Phone':     formatPhone(guardianPhone),
    'Emergency Contact':  emergName,
    'Emergency Phone':    formatPhone(emergPhone),
    'Medical Notes':      allergies || undefined,
    'Other Notes':        notes || undefined,
    'Photo Consent':      true,
    'Payment Status':     'Unpaid',
    'Amount':             20,
    'Source':             'Web form',
  };
  Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);

  try {
    await airtableCreate(env, fields);
  } catch (err) {
    // Don't lose the registration silently. Log it and tell the parent honestly.
    console.error('register: airtable write failed', err.message, { reference, playerName });
    return json(
      { ok: false, error: 'We could not save that registration. Please try again, or contact a coach.' },
      502,
    );
  }

  return json({ ok: true, reference, age });
}

export const onRequestGet = () => bad('POST only.', 405);
