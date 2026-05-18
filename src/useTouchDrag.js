import { useRef, useCallback } from 'react'

export function useTouchDrag({ onReorder }) {
  const dragIdx = useRef(null)
  const lastTargetIdx = useRef(null)
  const ghostRef = useRef(null)
  const itemRectsRef = useRef([])
  const containerRef = useRef(null)

  const createGhost = useCallback((sourceEl) => {
    const rect = sourceEl.getBoundingClientRect()
    const ghost = sourceEl.cloneNode(true)
    ghost.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      opacity: 0.85;
      pointer-events: none;
      z-index: 9999;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      transform: scale(1.03);
      background: #2a2a2a;
    `
    document.body.appendChild(ghost)
    ghostRef.current = ghost
    ghostRef.current._offsetX = rect.width / 2
    ghostRef.current._offsetY = rect.height / 2
    return ghost
  }, [])

  const removeGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove()
      ghostRef.current = null
    }
  }, [])

  const collectRects = useCallback((sourceEl) => {
    const parent = sourceEl.closest('[data-drag-container]') || sourceEl.parentElement
    containerRef.current = parent
    const items = Array.from(parent.querySelectorAll('[data-drag-item]'))
    itemRectsRef.current = items.map((el) => el.getBoundingClientRect())
  }, [])

  const restoreOpacity = useCallback(() => {
    if (containerRef.current) {
      Array.from(containerRef.current.querySelectorAll('[data-drag-item]'))
        .forEach((el) => { el.style.opacity = '' })
    }
  }, [])

  // getTouchHandlers è una factory: riceve index come ARGOMENTO (non closure)
  // quindi non va in nessuna lista di dipendenze
  const getTouchHandlers = useCallback((index) => ({
    'data-drag-item': true,

    onTouchStart: (e) => {
      if (e.target.closest('button, input, select, textarea, a')) return

      const touch = e.touches[0]
      dragIdx.current = index
      lastTargetIdx.current = index

      const sourceEl = e.currentTarget
      collectRects(sourceEl)
      createGhost(sourceEl)
      sourceEl.style.opacity = '0.3'

      const rect = sourceEl.getBoundingClientRect()
      ghostRef.current._offsetX = touch.clientX - rect.left
      ghostRef.current._offsetY = touch.clientY - rect.top
    },

    onTouchMove: (e) => {
      if (dragIdx.current === null || !ghostRef.current) return
      e.preventDefault()

      const touch = e.touches[0]

      ghostRef.current.style.left = `${touch.clientX - ghostRef.current._offsetX}px`
      ghostRef.current.style.top  = `${touch.clientY - ghostRef.current._offsetY}px`

      const rects = itemRectsRef.current
      let targetIdx = lastTargetIdx.current
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        if (
          touch.clientY >= r.top &&
          touch.clientY <= r.bottom &&
          touch.clientX >= r.left &&
          touch.clientX <= r.right
        ) {
          targetIdx = i
          break
        }
      }

      if (targetIdx !== lastTargetIdx.current) {
        onReorder(dragIdx.current, targetIdx)
        dragIdx.current = targetIdx
        lastTargetIdx.current = targetIdx
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const items = Array.from(containerRef.current.querySelectorAll('[data-drag-item]'))
            itemRectsRef.current = items.map((el) => el.getBoundingClientRect())
          }
        })
      }
    },

    onTouchEnd: () => {
      removeGhost()
      restoreOpacity()
      dragIdx.current = null
      lastTargetIdx.current = null
    },

    onTouchCancel: () => {
      removeGhost()
      restoreOpacity()
      dragIdx.current = null
      lastTargetIdx.current = null
    },
  }), [onReorder, collectRects, createGhost, removeGhost, restoreOpacity])

  return { getTouchHandlers }
}