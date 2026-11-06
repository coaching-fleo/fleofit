import '@google/model-viewer'

// La scarpa in 3D, da girare col dito. ⚠️ Si importa SOLO con React.lazy dalla scheda
// del modello: model-viewer porta three.js, e in un file condiviso finirebbe nel chunk
// d'ingresso (CLAUDE.md §2).
export default function Scarpa3D({ url, alt }) {
  return (
    <model-viewer
      src={url}
      alt={alt}
      camera-controls=""
      touch-action="pan-y"
      auto-rotate=""
      auto-rotate-delay="1500"
      rotation-per-second="18deg"
      interaction-prompt="none"
      camera-orbit="30deg 72deg auto"
      shadow-intensity="1"
      shadow-softness="1"
      exposure="1.05"
      style={{ width: '100%', height: '290px', '--poster-color': 'transparent', backgroundColor: 'transparent' }}
    />
  )
}
