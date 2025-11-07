"use client"

/**
 * Hook to typeset MathJax content
 */
export function typesetMany(nodes: HTMLElement[]) {
  // @ts-ignore
  const MJ = (typeof window !== 'undefined' && window.MathJax) || null
  if (!MJ) return Promise.resolve()
  
  // @ts-ignore
  return MJ.typesetPromise ? MJ.typesetPromise(nodes) : Promise.resolve()
}

