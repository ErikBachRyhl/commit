"use client"

import { useEffect } from "react"

export function MathJaxProvider() {
  useEffect(() => {
    if (window.MathJax) return
    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"
    script.async = true
    script.onload = () => {
      // Optional config overrides could be placed before load if needed.
    }
    document.head.appendChild(script)
  }, [])
  return null
}

