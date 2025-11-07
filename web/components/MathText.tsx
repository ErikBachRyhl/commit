"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    MathJax?: any
  }
}

export default function MathText({
  text,
  className,
  nonce,
}: {
  text: string
  className?: string
  nonce?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Set raw TeX as text (not HTML) to avoid XSS
    el.textContent = text || ""

    // Typeset when MathJax is ready
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([el]).catch(() => {
        // Typeset failed, but that's okay
      })
    }
  }, [text, nonce]) // Re-typeset on content OR flip nonce

  return <div ref={ref} className={className} />
}
