// Il primo import di main.jsx: sposta le chiavi `fleofit_*` prima che
// qualunque altro modulo legga localStorage (chiaviLocali.js).
import { traslocaChiavi } from './chiaviLocali'

traslocaChiavi()
