// Il ruolo di chi accede (admin / coach / nessuno) viene dalla tabella `staff`.
// ADMIN_EMAILS è solo la riserva per quando la tabella non risponde (non è
// ancora creata, o la rete cade): vive qui e App.jsx la ri-esporta.

export const ADMIN_EMAILS = ['coaching@federicoleo.it', 'alessandro.patrone@hotmail.it', 'federico_leo@hotmail.it', 'federico.leo88@gmail.com', 'demo@fleofit.it']

const normalizza = (email) => (email || '').trim().toLowerCase()

/** `'admin'`, `'coach'` o `null` (= atleta). Mai un'eccezione. */
export async function leggiRuolo(supabase, email) {
  const e = normalizza(email)
  try {
    const { data, error } = await supabase.from('staff').select('ruolo').eq('email', e).maybeSingle()
    if (error) return ADMIN_EMAILS.includes(e) ? 'admin' : null
    return data?.ruolo === 'admin' || data?.ruolo === 'coach' ? data.ruolo : null
  } catch {
    return ADMIN_EMAILS.includes(e) ? 'admin' : null
  }
}

export const eStaff = (role) => role === 'admin' || role === 'coach'
export const eAdmin = (role) => role === 'admin'
