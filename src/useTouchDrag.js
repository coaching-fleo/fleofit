import { useRef, useCallback, useEffect } from 'react'

/**
 * useTouchDrag — drag & drop touch-native per iOS/Android
 *
 * Restituisce { getTouchHandlers } da applicare a ogni elemento draggable.
 * Il riordino avviene live (come il desktop) tramite onReorder(fromIdx, toIdx).
 *
 * Uso:
 *   const { getTouchHandlers } = useTouchDrag({ onReorder })
 *   <div {...getTouchHandlers(index)} ...>
 */
export function useTouchDrag({ onReorder }) {
  const dragIdx = useRef(null)
  const lastTargetIdx = useRef(null)
  const ghostRef = useRef(null)
  const itemRectsRef = useRef([])
  const containerRef = useRef(null)
  const isDragging = useRef(false)
  const touchStartTimer = useRef(null)
  const currentDraggedElement = useRef(null)

  const preventScroll = useCallback((e) => {
    if (e.cancelable) e.preventDefault()
  }, [])

  const restoreOpacity = useCallback(() => {
    if (containerRef.current) {
      Array.from(containerRef.current.querySelectorAll('[data-drag-item]'))
        .forEach((el) => { el.style.opacity = '' })
    }
    if (currentDraggedElement.current) {
      currentDraggedElement.current.style.opacity = ''
    }
  }, [])

  const removeGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove()
      ghostRef.current = null
    }
  }, [])

  // Raccoglie le posizioni (bounding rect) di tutti i fratelli drag-item
  const collectRects = useCallback((sourceEl) => {
    const parent = sourceEl.closest('[data-drag-container]') || sourceEl.parentElement
    containerRef.current = parent
    const items = Array.from(parent.querySelectorAll('[data-drag-item]'))
    itemRectsRef.current = items.map((el) => el.getBoundingClientRect())
  }, [])

  // Crea un "ghost" visuale che segue il dito
  const createGhost = useCallback((sourceEl) => {
    const rect = sourceEl.getBoundingClientRect()
    const ghost = sourceEl.cloneNode(true)
    ghost.classList.remove('opacity-30', 'scale-[0.98]', 'shadow-lg');
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
      transition: transform 0.1s ease;
      background: #2a2a2a;
    `
    document.body.appendChild(ghost)
    ghostRef.current = ghost
    return ghost
  }, [])

  const startDrag = useCallback((clientX, clientY, index, sourceEl) => {
    isDragging.current = true
    currentDraggedElement.current = sourceEl
    sourceEl.style.opacity = '0.3'

    collectRects(sourceEl)
    createGhost(sourceEl)

    const rect = sourceEl.getBoundingClientRect()
    ghostRef.current._offsetX = clientX - rect.left
    ghostRef.current._offsetY = clientY - rect.top

    document.addEventListener('touchmove', preventScroll, { passive: false })

    if (navigator.vibrate) navigator.vibrate(40)
  }, [collectRects, createGhost, preventScroll])

  const getTouchHandlers = useCallback((index) => ({
    'data-drag-item': true,

    onTouchStart: (e) => {
      // Ignora se il tocco è su un button/input/select figlio
      if (e.target.closest('button, input, select, textarea, a')) return

      // Impedisce che il drag di un elemento figlio (es. esercizio) inneschi anche il drag del genitore (es. blocco)
      e.stopPropagation()

      const touch = e.touches[0]
      const clientX = touch.clientX
      const clientY = touch.clientY
      dragIdx.current = index
      lastTargetIdx.current = index

      const sourceEl = e.currentTarget
      touchStartTimer.current = setTimeout(() => {
        startDrag(clientX, clientY, index, sourceEl)
      }, 250)
    },

    onTouchMove: (e) => {
      if (!isDragging.current) {
        clearTimeout(touchStartTimer.current)
        return
      }
      if (dragIdx.current === null || !ghostRef.current) return

      const touch = e.touches[0]

      // Muovi il ghost
      ghostRef.current.style.left = `${touch.clientX - ghostRef.current._offsetX}px`
      ghostRef.current.style.top  = `${touch.clientY - ghostRef.current._offsetY}px`

      // Trova l'item sotto il dito
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
        // Ricalcola i rect dopo il riordino
        requestAnimationFrame(() => {
          if (containerRef.current) {
            const items = Array.from(containerRef.current.querySelectorAll('[data-drag-item]'))
            itemRectsRef.current = items.map((el) => el.getBoundingClientRect())
          }
        })
      }
    },

    onTouchEnd: () => {
      clearTimeout(touchStartTimer.current)
      isDragging.current = false
      document.removeEventListener('touchmove', preventScroll)
      removeGhost()
      restoreOpacity()
      dragIdx.current = null
      lastTargetIdx.current = null
    },

    onTouchCancel: () => {
      clearTimeout(touchStartTimer.current)
      isDragging.current = false
      document.removeEventListener('touchmove', preventScroll)
      removeGhost()
      restoreOpacity()
      dragIdx.current = null
      lastTargetIdx.current = null
    },
  }), [onReorder, startDrag, removeGhost, restoreOpacity, preventScroll])

  useEffect(() => {
    return () => {
      clearTimeout(touchStartTimer.current)
      document.removeEventListener('touchmove', preventScroll)
      removeGhost()
    }
  }, [removeGhost, preventScroll])

  return { getTouchHandlers }
}