"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, RefreshCw, FileText, MapPin } from "lucide-react"
import { toast } from "sonner"

type CardData = {
  id: string
  idx: number
  front: string
  back: string
  tags: string[]
  cardType: string
  sourceFile: string | null
  sourceLine: number | null
  state: string
  metadata: any
}

export function CardCarousel({ runId, cards }: { runId: string; cards: CardData[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [processedCards, setProcessedCards] = useState<Set<string>>(new Set())
  const [acceptedCount, setAcceptedCount] = useState(0)
  const [direction, setDirection] = useState(0)

  const currentCard = cards[currentIndex]
  const remainingCards = cards.length - processedCards.size
  const progress = processedCards.size / cards.length

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.key === 'a' || e.key === 'A') {
        handleAdd()
      } else if (e.key === 'd' || e.key === 'D') {
        handleDiscard()
      } else if (e.key === 'r' || e.key === 'R') {
        handleRecreate()
      } else if (e.key === ' ') {
        e.preventDefault()
        setShowBack(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentIndex, currentCard])

  async function handleAdd() {
    if (!currentCard || processedCards.has(currentCard.id)) return

    try {
      const response = await fetch(`/api/cards/${currentCard.id}/add`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to add card')
      }

      toast.success('Card added!')
      setAcceptedCount(prev => prev + 1)
      setProcessedCards(prev => new Set(prev).add(currentCard.id))
      nextCard(1)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function handleDiscard() {
    if (!currentCard || processedCards.has(currentCard.id)) return

    try {
      const response = await fetch(`/api/cards/${currentCard.id}/discard`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to discard card')
      }

      toast('Card discarded')
      setProcessedCards(prev => new Set(prev).add(currentCard.id))
      nextCard(-1)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  async function handleRecreate() {
    if (!currentCard) return

    try {
      toast.loading('Regenerating card...', { id: 'regenerate' })

      const response = await fetch(`/api/cards/${currentCard.id}/recreate`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to recreate card')
      }

      toast.success('Card regenerated! Refresh to see updates.', { id: 'regenerate' })
    } catch (error: any) {
      toast.error(error.message, { id: 'regenerate' })
    }
  }

  function nextCard(dir: number) {
    setDirection(dir)
    setShowBack(false)

    // Find next unprocessed card
    let nextIndex = currentIndex + 1
    while (nextIndex < cards.length && processedCards.has(cards[nextIndex].id)) {
      nextIndex++
    }

    if (nextIndex < cards.length) {
      setCurrentIndex(nextIndex)
    }
  }

  if (!currentCard || processedCards.has(currentCard.id)) {
    // All cards processed
    return (
      <Card>
        <CardHeader>
          <CardTitle>All Done! 🎉</CardTitle>
          <CardDescription>
            You've reviewed all {cards.length} cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✓</div>
              <p className="text-xl font-semibold mb-2">
                {acceptedCount} cards accepted
              </p>
              <p className="text-muted-foreground">
                {cards.length - acceptedCount} cards discarded
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.href = `/runs/${runId}/download`}>
                Download .apkg
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/'}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Card {currentIndex + 1} of {cards.length}
        </span>
        <span className="text-muted-foreground">
          {acceptedCount} accepted • {remainingCards} remaining
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentCard.id}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 300 : -300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -300 : 300 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Card className="cursor-pointer" onClick={() => setShowBack(!showBack)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{currentCard.cardType}</Badge>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {currentCard.sourceFile && (
                    <>
                      <FileText className="h-3 w-3" />
                      <span className="font-mono">{currentCard.sourceFile}</span>
                      {currentCard.sourceLine && (
                        <>
                          <MapPin className="h-3 w-3" />
                          <span>Line {currentCard.sourceLine}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-[200px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  {!showBack ? (
                    <motion.div
                      key="front"
                      initial={{ opacity: 0, rotateY: -90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      exit={{ opacity: 0, rotateY: 90 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-center mb-4">
                        <Badge variant="secondary">Front</Badge>
                      </div>
                      <div
                        className="prose prose-sm max-w-none text-center"
                        dangerouslySetInnerHTML={{ __html: currentCard.front }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="back"
                      initial={{ opacity: 0, rotateY: -90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      exit={{ opacity: 0, rotateY: 90 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="text-center mb-4">
                        <Badge variant="secondary">Back</Badge>
                      </div>
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: currentCard.back }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tags */}
              {currentCard.tags.length > 0 && (
                <div className="mt-6 pt-4 border-t flex flex-wrap gap-2">
                  {currentCard.tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        <Button
          variant="destructive"
          size="lg"
          onClick={handleDiscard}
        >
          <XCircle className="h-5 w-5 mr-2" />
          Discard (D)
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleRecreate}
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Recreate (R)
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={handleAdd}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          Add (A)
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Click card or press Space to flip • Use A/D/R keys for actions
      </p>
    </div>
  )
}

