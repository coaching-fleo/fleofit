// L'accenno si fa una volta per avvio dell'app, non a ogni apertura: la
// seconda volta il gesto è già noto e la riga che si muove da sola distrae.
let accennoFatto = false
export const prendiAccenno = () => {
  if (accennoFatto) return false
  accennoFatto = true
  return true
}
