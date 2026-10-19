'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import PrecisionRail from './PrecisionRail'
import CommandDeck from './CommandDeck'
import WorkflowAtlas from './WorkflowAtlas'
import styles from './prototype.module.css'

const variants = [
  { name: 'Precision Rail', Component: PrecisionRail },
  { name: 'Command Deck', Component: CommandDeck },
  { name: 'Workflow Atlas', Component: WorkflowAtlas },
]

function variantFromUrl() {
  const value = Number.parseInt(new URLSearchParams(window.location.search).get('v') || '1', 10)
  return Number.isFinite(value) && value >= 1 && value <= variants.length ? value - 1 : 0
}

export default function NavigationPrototype() {
  const [current, setCurrent] = useState(0)
  const [mountKey, setMountKey] = useState(0)
  const pickerRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const moveHighlight = useCallback(() => {
    const item = itemRefs.current[current]
    const highlight = highlightRef.current
    if (!item || !highlight) return
    highlight.style.width = `${item.offsetWidth}px`
    highlight.style.transform = `translateX(${item.offsetLeft}px)`
  }, [current])

  const setActive = useCallback((index: number) => {
    if (index < 0 || index >= variants.length) return
    setCurrent(index)
    setMountKey(value => value + 1)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(null, '', url)
  }, [])

  useLayoutEffect(moveHighlight, [moveHighlight])

  useEffect(() => {
    const savedVariant = variantFromUrl()
    if (savedVariant !== 0) {
      setCurrent(savedVariant)
      setMountKey(value => value + 1)
    }
    const first = window.requestAnimationFrame(() => {
      const second = window.requestAnimationFrame(() => pickerRef.current?.setAttribute('data-ready', ''))
      return () => window.cancelAnimationFrame(second)
    })
    const onResize = () => moveHighlight()
    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(first)
      window.removeEventListener('resize', onResize)
    }
  }, [moveHighlight])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= variants.length) setActive(number - 1)
      else if (event.key === 'ArrowRight') setActive((current + 1) % variants.length)
      else if (event.key === 'ArrowLeft') setActive((current - 1 + variants.length) % variants.length)
      else if (event.key === 'r' || event.key === 'R') setMountKey(value => value + 1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [current, setActive])

  const ActiveVariant = variants[current].Component

  return (
    <div className={styles.prototypeHost}>
      <div id="stage" className={styles.stage}>
        <ActiveVariant key={`${current}-${mountKey}`} />
      </div>

      <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants">
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true"></span>
        {variants.map((variant, index) => (
          <button
            key={variant.name}
            ref={element => { itemRefs.current[index] = element }}
            className="proto-picker-item"
            data-active={current === index ? '' : undefined}
            aria-current={current === index ? 'true' : undefined}
            onClick={() => setActive(index)}
          >
            {variant.name}
          </button>
        ))}
      </nav>
    </div>
  )
}
