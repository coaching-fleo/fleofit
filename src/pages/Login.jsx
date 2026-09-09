import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Mail, Lock } from 'lucide-react'
import { CustomAlert } from '../components/CustomModals'
import { Browser } from '@capacitor/browser'
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { generaNonce, nomeDaApple, annullatoDallUtente } from '../lib/appleLogin'
import { leggiJson } from '../lib/offlineQueue'
import {
  normalizzaCodice, codiceCompleto, LUNGHEZZA_CODICE,
  AVVISO_CODICE_RIFIUTATO, AVVISO_CODICE_OFFLINE,
} from '../lib/codiceInvito'
import {
  Guscio, Marchio, BottoneIdentita, IconaApple, IconaGoogle, NotaInvito,
  TestataPasso, CaselleCodice, BottoneIncolla, AvvisoCodice, RigaAiuto,
  CardInvitoValido, CardProfilo, CtaGialla, FoglioAiuto, CampoTesto,
} from '../components/LoginUI'

/**
 * L'accesso, rifatto sull'artboard `Login.dc.html` opzione 1b (04/09/2026).
 *
 * 🔴 **Il bivio è sparito, ed è tutta la sostanza del rework.** La schermata
 * di benvenuto chiedeva «Accedi» o «Nuovo Utente», cioè una cosa che l'utente
 * non sa: chi sbagliava finiva contro il muro del codice invito, che non
 * spiegava né cos'era il codice né chi lo dà né cosa fare senza. E la CTA
 * gialla — l'unico tratto forte della pagina — stava sul percorso che riguarda
 * una persona al mese, mentre chi torna ogni giorno prendeva il bottone grigio.
 *
 * Ora c'è **una colonna sola di modi per entrare**, identica per chi ha un
 * profilo e per chi non ce l'ha. Il codice non è più una porta davanti alla
 * casa: è la domanda che l'app fa quando scopre di non conoscerti — cioè al
 * passo 2, e solo a chi serve.
 *
 * ⚠️ Il passo 2 si raggiunge anche da FUORI questa pagina: `ProtectedRoute`
 * manda qui con `?serve=invito` chi si è autenticato ma non ha un profilo, che
 * fino al 04/09/2026 era un `signOut()` e un alert «Accesso Negato» senza
 * nessuna via d'uscita se non chiudere l'app.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // benvenuto · email (passo 1) · codice (passo 2) · recupero (dal link di reset)
  const [vista, setVista] = useState('benvenuto')
  const [recuperoPassword, setRecuperoPassword] = useState(false)
  const [nonRiconosciuto, setNonRiconosciuto] = useState(false)

  const [codice, setCodice] = useState('')
  const [invito, setInvito] = useState(null)      // il codice VERIFICATO, non quello scritto
  const [avviso, setAvviso] = useState(null)
  const [verificando, setVerificando] = useState(false)
  const [aiutoAperto, setAiutoAperto] = useState(false)
  const campoCodice = useRef(null)

  // Chi è, e come rientra: lo sa `ProtectedRoute` quando ci manda qui, e lo
  // sappiamo noi quando l'email l'ha appena scritta l'utente. Se non lo sa
  // nessuno — è il caso di chi arriva dal link del coach — resta `null`, e la
  // schermata del codice offre di nuovo i tre modi di entrare invece di
  // inventarsi un indirizzo.
  const [emailNota, setEmailNota] = useState('')
  const [ripresa, setRipresa] = useState(null)    // 'apple' | 'google' | 'email' | null

  // L'onboarding del ruolo coach è disattivato: qui il ruolo è sempre 'athlete'.
  const role = 'athlete'
  const [alertInfo, setAlertInfo] = useState(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Il bottone Apple si mostra SOLO sul nativo. Il flusso web richiederebbe un
  // Services ID e una chiave .p8 su Apple Developer, che questo progetto non ha
  // (decisione del committente, 03/09/2026: la web app resta fuori dal lavoro
  // su Sign in with Apple). Un bottone che non può funzionare è peggio che non
  // averlo: è la stessa regola del badge sulla navbar (CLAUDE.md §9-quaterdecies)
  // e del pannello filtri dell'archivio (§9-sedecies).
  const isNativo = typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.()

  // Gli appunti si LEGGONO solo dove il browser lo permette: senza `readText`
  // il bottone «Incolla» non potrebbe fare niente, e sotto le caselle c'è
  // comunque un campo vero su cui funziona l'incolla di sistema.
  const puoIncollare = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText

  const baseUrl = isNativo ? 'fleofit://login-callback' : (typeof window !== 'undefined' ? window.location.origin : '')

  /**
   * Verifica un codice contro il database.
   *
   * ⚠️ `maybeSingle()` e non `single()`: con `single()` «nessuna riga» torna
   * come **errore**, indistinguibile da un guasto di rete — e le due cose
   * hanno due risposte opposte da dare all'utente («chiedi un codice nuovo»
   * contro «riprova fra un momento»). Con `maybeSingle()` il codice assente è
   * `data: null` con `error: null`, e la distinzione esiste.
   */
  const verificaCodice = useCallback(async (daVerificare) => {
    setVerificando(true)
    setAvviso(null)
    const { data, error } = await supabase
      .from('invitation_codes')
      .select('code')
      .eq('code', daVerificare)
      .eq('is_active', true)
      .is('used_by', null)
      .maybeSingle()
    setVerificando(false)

    if (error) return setAvviso(AVVISO_CODICE_OFFLINE)
    if (!data) return setAvviso(AVVISO_CODICE_RIFIUTATO)

    // Da qui in poi il codice vive in localStorage: è `ProtectedRoute` a
    // riscattarlo (UPDATE con `used_by`), perché quella scrittura richiede una
    // sessione e a questo punto la sessione non c'è ancora.
    localStorage.setItem('fleofit_invite_code', data.code)
    setInvito(data.code)
  }, [])

  useEffect(() => {
    let isRecovery = window.location.hash.includes('type=recovery')
    if (isRecovery) setVista('recupero')

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        isRecovery = true
        setVista('recupero')
      } else if (session && !isRecovery) {
        navigate('/')
      }
    })

    if (!isRecovery) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) navigate('/')
      })
    }

    // 🔴 Il link del coach salta le caselle. Chi apre `?invite=CODICE` non deve
    // vederle mai: arriva direttamente sulla card verde con il codice dentro.
    // Prima finiva sul form del codice con uno spinner, cioè sulla schermata
    // che il link esiste per evitare.
    const dallUrl = searchParams.get('invite')
    if (dallUrl && !isRecovery) {
      const pulito = normalizzaCodice(dallUrl)
      setCodice(pulito)
      setVista('codice')
      navigate('/login', { replace: true })
      if (codiceCompleto(pulito)) verificaCodice(pulito)
      else setAvviso(AVVISO_CODICE_RIFIUTATO)
    }

    // Arriva da `ProtectedRoute`: autenticato, ma senza un profilo. Il codice
    // è l'unica cosa che manca, e adesso sappiamo per chi.
    if (searchParams.get('serve') === 'invito') {
      const atteso = leggiJson('fleofit_invito_atteso', null)
      if (atteso?.email) setEmailNota(atteso.email)
      if (atteso?.provider) setRipresa(atteso.provider === 'email' ? 'email' : atteso.provider)
      // ⚠️ Si consuma subito: è un passaggio di consegne fra due caricamenti
      // della pagina, non una preferenza. Lasciandolo lì, il prossimo che apre
      // il passo 2 su questo telefono si vedrebbe in testa l'indirizzo di
      // qualcun altro — e la schermata dell'invito è l'ultima in cui si può
      // scrivere il nome sbagliato.
      localStorage.removeItem('fleofit_invito_atteso')
      setVista('codice')
      navigate('/login', { replace: true })
    }

    // La vecchia uscita di sicurezza: non la produce più nessuno, ma un deep
    // link salvato o una vecchia copia dell'app possono ancora portarla.
    if (searchParams.get('error') === 'unauthorized') {
      setVista('codice')
      navigate('/login', { replace: true })
    }

    return () => subscription.unsubscribe()
  }, [navigate, searchParams, verificaCodice])

  // ── Le caselle ────────────────────────────────────────────────────────────

  /**
   * ⚠️ La verifica parte **da sola** all'ottavo carattere: niente bottone
   * «Prosegui» da cercare. Il codice ha una lunghezza fissa e la si vede, e
   * chiedere un tocco in più su un campo che è manifestamente completo è il
   * genere di attrito che fa credere che qualcosa non abbia funzionato.
   */
  const scriviCodice = (grezzo) => {
    const pulito = normalizzaCodice(grezzo)
    setCodice(pulito)
    setAvviso(null)
    if (codiceCompleto(pulito)) verificaCodice(pulito)
  }

  const incollaCodice = async () => {
    try {
      scriviCodice(await navigator.clipboard.readText())
    } catch {
      setAvviso({
        titolo: 'Non riusciamo a leggere gli appunti.',
        corpo: 'Tocca le caselle e usa l\'«Incolla» della tastiera: il codice entra lo stesso.',
      })
    }
  }

  const riprovaCodice = () => {
    setCodice('')
    setAvviso(null)
    campoCodice.current?.focus()
  }

  // ── I tre modi di entrare ─────────────────────────────────────────────────

  /**
   * Sign in with Apple. Sta ACCANTO a Google, non al suo posto.
   *
   * La linea guida 4.8 di App Store non vieta i login di terze parti: chiede
   * che accanto ce ne sia uno che permetta di tenere nascosta la propria email
   * a tutti, cosa che né Google né email+password fanno. È il rilievo del
   * 02/09/2026 sulla build 1.1.0 (3).
   *
   * ⚠️ Dal 04/09/2026 **non c'è più il controllo del codice invito qui davanti**.
   * Era il muro che il rework toglie: chi non ha un profilo lo scopre dopo, da
   * `ProtectedRoute`, e torna qui al passo 2 con la propria email in testa. Il
   * codice continua a essere obbligatorio — a farlo rispettare sono la RLS e
   * `ProtectedRoute`, che è dove è sempre stato deciso davvero.
   */
  const entraConApple = async () => {
    setLoading(true)
    try {
      const nonce = await generaNonce()

      const { response } = await SignInWithApple.authorize({
        // Sul nativo Apple riconosce l'app dal bundle id del binario:
        // ASAuthorization ignora questi due campi, che il plugin però esige.
        clientId: 'it.federicoleo.fleofit',
        redirectURI: 'fleofit://login-callback',
        scopes: 'email name',
        // Al plugin l'HASH, a Supabase il valore in chiaro: vedi lib/appleLogin.js.
        ...(nonce ? { nonce: nonce.hash } : {}),
      })

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: response.identityToken,
        ...(nonce ? { nonce: nonce.chiaro } : {}),
      })
      if (error) throw error

      // Il nome arriva SOLO adesso, e mai più: va scritto prima di lasciare la
      // pagina. Se fallisce non si blocca l'accesso — al massimo l'onboarding
      // parte con i campi vuoti — ma l'errore si logga invece di sparire
      // (CLAUDE.md §9-quater: i catch muti hanno già nascosto tre guasti).
      const nome = nomeDaApple(response)
      if (nome) {
        const { error: erroreNome } = await supabase.auth.updateUser({ data: nome })
        if (erroreNome) console.error('Nome da Apple non salvato:', erroreNome.message)
      }

      navigate('/')
    } catch (error) {
      if (annullatoDallUtente(error?.message)) return
      setAlertInfo({ title: 'Errore Sign in with Apple', message: error?.message || 'Accesso non riuscito.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const entraConGoogle = async () => {
    const codiceInvito = localStorage.getItem('fleofit_invite_code')
    const redirectUrl = codiceInvito ? `${baseUrl}?inviteCode=${codiceInvito}` : baseUrl

    try {
      if (isNativo) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
            queryParams: { prompt: 'select_account' },
          },
        })
        if (error) throw error
        if (data?.url) await Browser.open({ url: data.url })
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl, queryParams: { prompt: 'select_account' } },
        })
        if (error) throw error
      }
    } catch (error) {
      setAlertInfo({ title: 'Errore Google OAuth', message: error.message, type: 'error' })
    }
  }

  /**
   * Passo 1, percorso email.
   *
   * 🔴 **Supabase non dice se un account esiste, ed è voluto** (impedisce di
   * enumerare gli indirizzi): password sbagliata e profilo inesistente
   * tornano lo stesso `Invalid login credentials`. Quindi qui il ramo non si
   * indovina — si offrono le due uscite, una per ciascuno dei due casi. È il
   * limite di questo percorso rispetto a Apple e Google, dove è il provider a
   * dirci chi sei prima che si arrivi a chiederlo.
   */
  const entraConEmail = async () => {
    if (!email || (!recuperoPassword && !password)) {
      setAlertInfo({ title: 'Errore', message: 'Compila tutti i campi richiesti.', type: 'error' })
      return
    }
    setLoading(true)
    setNonRiconosciuto(false)

    try {
      if (recuperoPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: baseUrl })
        if (error) throw error
        setAlertInfo({ title: 'Email inviata', message: 'Se l\'indirizzo è corretto, riceverai un link per reimpostare la password.', type: 'success' })
        setRecuperoPassword(false)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (/invalid login credentials/i.test(error.message || '')) {
          setNonRiconosciuto(true)
          return
        }
        throw error
      }
      navigate('/')
    } catch (error) {
      setAlertInfo({ title: 'Errore di autenticazione', message: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  /** Passo 2, percorso email: il codice è valido, manca solo la password. */
  const creaProfilo = async () => {
    const codiceInvito = localStorage.getItem('fleofit_invite_code')
    if (!codiceInvito) {
      setAlertInfo({ title: 'Accesso Negato', message: 'Per registrarti è necessario un codice di invito valido.', type: 'error' })
      return
    }
    if (!password || password.length < 6) {
      setAlertInfo({ title: 'Errore', message: 'La password deve avere almeno 6 caratteri.', type: 'error' })
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: emailNota || email,
        password,
        options: { data: { role }, emailRedirectTo: `${baseUrl}?inviteCode=${codiceInvito}` },
      })
      if (error) throw error
      setAlertInfo({ title: 'Controlla la mail', message: 'Ti abbiamo inviato un link per confermare la registrazione.', type: 'success' })
    } catch (error) {
      setAlertInfo({ title: 'Errore di autenticazione', message: error.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const aggiornaPassword = async () => {
    if (!password || password.length < 6) {
      return setAlertInfo({ title: 'Errore', message: 'La password deve avere almeno 6 caratteri.', type: 'error' })
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setAlertInfo({ title: 'Errore', message: error.message, type: 'error' })
    } else {
      setAlertInfo({ title: 'Successo', message: 'Password aggiornata con successo! Ora puoi accedere.', type: 'success' })
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
      navigate('/')
    }
  }

  const tornaIndietro = () => {
    if (vista === 'recupero') {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search)
      return setVista('benvenuto')
    }
    if (recuperoPassword) return setRecuperoPassword(false)
    if (vista === 'codice' && invito) {
      // Tornare dalla card verde vuol dire rimettere in discussione il codice,
      // non uscire dal passo: le caselle tornano, il codice resta scritto.
      setInvito(null)
      return
    }
    setNonRiconosciuto(false)
    setVista('benvenuto')
  }

  // ── Le tre schermate ──────────────────────────────────────────────────────

  const modiPerEntrare = (dentroIlPasso2 = false) => (
    <div className="flex flex-col gap-2.5">
      {isNativo && (
        <BottoneIdentita
          icona={<IconaApple />} etichetta="Continua con Apple"
          onClick={entraConApple} disabled={loading}
        />
      )}
      <BottoneIdentita
        icona={<IconaGoogle />} etichetta="Continua con Google"
        onClick={entraConGoogle} disabled={loading}
      />
      {!dentroIlPasso2 && (
        <BottoneIdentita
          variante="scuro" icona={<Mail size={19} className="text-gray-400" />}
          etichetta="Continua con email" onClick={() => setVista('email')} disabled={loading}
        />
      )}
    </div>
  )

  const benvenuto = (
    <>
      <div className="flex-1 flex items-center justify-center"><Marchio /></div>
      <div className="flex flex-col gap-2.5">
        {modiPerEntrare()}
        <div className="mt-4"><NotaInvito /></div>
        {/* ⚠️ Termini e Privacy sono TESTO, non collegamenti: il progetto non
            ha una URL pubblica che li serva (privacy-policy.html sta in radice,
            fuori da `public/`, e su Vercel non è raggiungibile). Un link che
            porta a un 404 sulla schermata di accesso è peggio di una riga che
            non promette una destinazione — voce in BACKLOG. */}
        <p className="mt-3 text-center text-[11px] leading-[1.5] font-medium text-muted">
          Continuando accetti i <span className="text-gray-300 font-semibold">Termini</span> e la <span className="text-gray-300 font-semibold">Privacy</span> di FLEOFIT
        </p>
      </div>
    </>
  )

  const passoEmail = (
    <>
      <TestataPasso passo={1} onIndietro={tornaIndietro} />
      <h1 className="text-[28px] font-black tracking-[-.03em] leading-[1.1] text-white mb-2">
        {recuperoPassword ? <>Reimposta la<br />tua password</> : <>Entra con la<br />tua email</>}
      </h1>
      <p className="text-sm leading-[1.5] font-medium text-muted mb-6">
        {recuperoPassword
          ? 'Ti mandiamo un link per sceglierne una nuova.'
          : 'Se non hai ancora un profilo te ne accorgi qui: al passo 2 ti chiediamo il codice del tuo coach.'}
      </p>

      <div className="flex flex-col gap-2.5" onKeyDown={(e) => { if (e.key === 'Enter') entraConEmail() }}>
        <CampoTesto
          icona={<Mail size={18} />} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off"
          aria-label="Email" placeholder="La tua email" value={email} onChange={(e) => setEmail(e.target.value)}
        />
        {!recuperoPassword && (
          <CampoTesto
            icona={<Lock size={18} />} type="password" autoComplete="current-password"
            aria-label="Password" placeholder="La tua password" value={password} onChange={(e) => setPassword(e.target.value)}
          />
        )}
      </div>

      {nonRiconosciuto && (
        <div className="mt-3">
          <AvvisoCodice
            titolo="Non riusciamo a farti entrare."
            corpo="O la password non è quella giusta, oppure non hai ancora un profilo: in quel caso serve il codice invito del tuo coach."
          />
          <div className="flex gap-2.5 mt-2.5">
            <button type="button" onClick={() => { setNonRiconosciuto(false); setRecuperoPassword(true) }}
              className="flex-1 bg-surface2 border border-[#383838] rounded-2xl p-3.5 text-[15px] font-bold text-white hover:bg-[#333] transition">
              Password dimenticata
            </button>
            <button type="button" onClick={() => { setEmailNota(email); setRipresa('email'); setNonRiconosciuto(false); setVista('codice') }}
              className="flex-1 bg-surface2 border border-[#383838] rounded-2xl p-3.5 text-[15px] font-bold text-white hover:bg-[#333] transition">
              Ho un codice invito
            </button>
          </div>
        </div>
      )}

      {!recuperoPassword && !nonRiconosciuto && (
        <button type="button" onClick={() => setRecuperoPassword(true)}
          className="self-end mt-3 text-xs font-semibold text-brand hover:underline">
          Password dimenticata?
        </button>
      )}

      <div className="flex-1 min-h-5" />
      <CtaGialla
        etichetta={loading ? 'Attendere...' : (recuperoPassword ? 'Invia il link' : 'Continua')}
        onClick={entraConEmail} disabled={loading}
      />
    </>
  )

  const passoCodice = (
    <>
      <TestataPasso passo={2} onIndietro={tornaIndietro} />

      {invito ? (
        <>
          <CardInvitoValido codice={invito} />
          {emailNota
            ? (
              <>
                <CardProfilo
                  email={emailNota} password={password} onPassword={setPassword}
                  chiediPassword={ripresa === 'email'} onInvio={creaProfilo}
                />
                <div className="flex-1 min-h-5" />
                {ripresa === 'email'
                  ? <CtaGialla etichetta={loading ? 'Attendere...' : 'Crea il profilo'} onClick={creaProfilo} disabled={loading} />
                  : (
                    <>
                      <p className="text-sm font-medium text-muted mb-3 text-center">Rientra con lo stesso accesso di prima: il codice è già collegato.</p>
                      {modiPerEntrare(true)}
                    </>
                  )}
              </>
            )
            : (
              // Nessuna email nota: è chi arriva dal link del coach senza aver
              // ancora detto chi è. Non si inventa un indirizzo — si torna a
              // chiedere come vuole entrare, con il codice ormai al sicuro.
              <>
                <div className="flex-1 min-h-6" />
                <p className="text-sm font-medium text-muted mb-3 text-center">Scegli come entrare: il codice resta collegato al profilo che stai creando.</p>
                {modiPerEntrare()}
              </>
            )}
        </>
      ) : (
        <>
          <h1 className="text-[28px] font-black tracking-[-.03em] leading-[1.1] text-white mb-2">
            Il codice del<br />tuo coach
          </h1>
          <p className="text-sm leading-[1.5] font-medium text-muted mb-6">
            {emailNota
              ? <>Non c'è ancora un profilo per <b className="text-gray-300 font-bold">{emailNota}</b>. Il tuo coach ti ha mandato un codice di {LUNGHEZZA_CODICE} caratteri: incollalo qui e sei dentro.</>
              : <>Il tuo coach ti manda un codice di {LUNGHEZZA_CODICE} caratteri su WhatsApp, oppure come link. Incollalo qui e sei dentro.</>}
          </p>

          <CaselleCodice
            valore={codice} onChange={scriviCodice} errore={!!avviso}
            disabled={verificando} campoRef={campoCodice} descrittoDa={avviso ? 'avviso-codice' : undefined}
          />

          <div className="mt-3.5">
            {avviso
              ? (
                <>
                  <AvvisoCodice id="avviso-codice" titolo={avviso.titolo} corpo={avviso.corpo} />
                  <div className="flex gap-2.5 mt-3.5">
                    <button type="button" onClick={riprovaCodice}
                      className="flex-1 bg-surface2 border border-[#383838] rounded-2xl p-3.5 text-[15px] font-bold text-white hover:bg-[#333] transition">
                      Riprova
                    </button>
                    <button type="button" onClick={() => setAiutoAperto(true)}
                      className="flex-1 bg-surface2 border border-[#383838] rounded-2xl p-3.5 text-[15px] font-bold text-white hover:bg-[#333] transition">
                      Aiuto
                    </button>
                  </div>
                </>
              )
              : puoIncollare && <BottoneIncolla onClick={incollaCodice} disabled={verificando} />}
          </div>

          {/* ⚠️ La riga d'aiuto segue le caselle, non è ancorata in fondo. Sul
              telefono questa schermata si guarda con la tastiera aperta — è lo
              stato che l'artboard disegna — e una riga ancorata al fondo ci
              finisce sotto, mentre a tastiera chiusa lascia mezzo schermo di
              vuoto in mezzo. Vista a 393px, non leggendo il codice. */}
          <div className="mt-6">
            {!avviso && <RigaAiuto onClick={() => setAiutoAperto(true)} />}
          </div>
        </>
      )}
    </>
  )

  const passoRecupero = (
    <>
      <TestataPasso passo={1} onIndietro={tornaIndietro} />
      <h1 className="text-[28px] font-black tracking-[-.03em] leading-[1.1] text-white mb-2">
        Scegli la tua<br />nuova password
      </h1>
      <p className="text-sm leading-[1.5] font-medium text-muted mb-6">Almeno 6 caratteri. Poi si entra subito.</p>
      <div onKeyDown={(e) => { if (e.key === 'Enter') aggiornaPassword() }}>
        <CampoTesto
          icona={<Lock size={18} />} type="password" autoComplete="new-password"
          aria-label="Nuova password" placeholder="La tua nuova password"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex-1 min-h-5" />
      <CtaGialla etichetta={loading ? 'Attendere...' : 'Aggiorna la password'} onClick={aggiornaPassword} disabled={loading || !password} />
    </>
  )

  return (
    <Guscio tinta={vista === 'codice' && invito ? 'verde' : 'ambra'}>
      {vista === 'benvenuto' && benvenuto}
      {vista === 'email' && passoEmail}
      {vista === 'codice' && passoCodice}
      {vista === 'recupero' && passoRecupero}

      {aiutoAperto && (
        <FoglioAiuto
          onChiudi={() => setAiutoAperto(false)}
          onScrivi={() => {
            // Non c'è nessun canale di assistenza nel prodotto: l'unico
            // indirizzo che l'app conosce è quello del coach, ed è anche
            // l'unica risposta sensata a «non ho un codice».
            window.location.href = 'mailto:coaching@federicoleo.it?subject=' + encodeURIComponent('FLEOFIT — non ho un codice invito')
          }}
        />
      )}

      {createPortal(
        <CustomAlert info={alertInfo} onClose={() => setAlertInfo(null)} />,
        document.body
      )}
    </Guscio>
  )
}
