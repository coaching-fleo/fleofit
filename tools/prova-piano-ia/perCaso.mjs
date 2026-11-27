// Il giro sui casi del banco. Le chiamate sono A PAGAMENTO: un 429 o un 5xx al
// caso 20 non deve buttare via i 19 già pagati. Per questo ogni caso ha il suo
// try/catch (l'errore diventa una riga con motivo 'errore') e i risultati si
// salvano dopo ogni caso, non alla fine.

/**
 * @param {object[]} casi
 * @param {(caso: object) => Promise<object|null>} fai  la riga del caso, o null se non c'è niente da scrivere
 * @param {(righe: object[]) => void} salva  chiamata dopo ogni riga
 */
export async function perCaso(casi, fai, salva) {
  const righe = []
  for (const c of casi) {
    let riga
    try {
      riga = await fai(c)
    } catch (e) {
      riga = { caso: c.id, motivo: 'errore', errore: String(e?.message ?? e) }
      console.log(`${c.id}  errore: ${riga.errore}`)
    }
    if (!riga) continue
    righe.push(riga)
    salva(righe)
  }
  return righe
}
