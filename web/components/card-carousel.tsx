"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, XCircle, RefreshCw, FileText, MapPin, Edit } from "lucide-react"
import { toast } from "sonner"
import MathText from "@/components/MathText"

type CardData = {
  id: string
  idx: number
  front: string
  back: string
  tags: string[]
  cardType: string
  sourceFile: string | null
  sourceLine: number | null
  status: string
  frontEdited?: string | null
  backEdited?: string | null
  isEdited?: boolean
  metadata: any
}

export function CardCarousel({ runId, cards }: { runId: string; cards: CardData[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [processedCards, setProcessedCards] = useState<Set<string>>(new Set())
  const [direction, setDirection] = useState(0)
  const [showEdit, setShowEdit] = useState(false)
  const [editFront, setEditFront] = useState("")
  const [editBack, setEditBack] = useState("")
  const [localCards, setLocalCards] = useState(cards)
  const [busyCardId, setBusyCardId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const currentCard = localCards[currentIndex]
  
  // Compute progress from current card statuses (prevents negative/overflow)
  const total = localCards.length
  const acceptedCount = localCards.filter(c => c.status === 'ACCEPTED').length
  const discardedCount = localCards.filter(c => c.status === 'DISCARDED').length
  const reviewedCount = acceptedCount + discardedCount
  const remainingCards = total - reviewedCount
  const progress = total > 0 ? reviewedCount / total : 0

  // Update local cards when props change
  useEffect(() => {
    setLocalCards(cards)
  }, [cards])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      // Ignore repeated keydown events (held keys) to prevent spam
      if (e.repeat) return
      // Block all actions if a card operation is in progress
      if (busyCardId) return
      // Block shortcuts when edit dialog is open
      if (showEdit) return
      // Block shortcuts when typing in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      // Prevent default for action keys to avoid typing into inputs
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        handleAccept()
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        handleDiscard()
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleRegenerate()
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        handleEditClick()
      } else if (e.key === ' ') {
        e.preventDefault()
        setShowBack(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentIndex, currentCard, busyCardId, showEdit])

  async function handleAccept() {
    if (!currentCard || processedCards.has(currentCard.id) || busyCardId === currentCard.id) return

    setBusyCardId(currentCard.id)
    try {
      const response = await fetch(`/api/cards/${currentCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      })

      if (!response.ok) {
        throw new Error('Failed to accept card')
      }

      toast.success('Card accepted!')
      // Update local card state optimistically
      setLocalCards(prev => prev.map(c => 
        c.id === currentCard.id ? { ...c, status: 'ACCEPTED' } : c
      ))
      setProcessedCards(prev => new Set(prev).add(currentCard.id))
      nextCard(1)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusyCardId(null)
    }
  }

  async function handleDiscard() {
    if (!currentCard || processedCards.has(currentCard.id) || busyCardId === currentCard.id) return

    setBusyCardId(currentCard.id)
    try {
      const response = await fetch(`/api/cards/${currentCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISCARDED' }),
      })

      if (!response.ok) {
        throw new Error('Failed to discard card')
      }

      toast('Card discarded')
      // Update local card state optimistically
      setLocalCards(prev => prev.map(c => 
        c.id === currentCard.id ? { ...c, status: 'DISCARDED' } : c
      ))
      setProcessedCards(prev => new Set(prev).add(currentCard.id))
      nextCard(-1)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setBusyCardId(null)
    }
  }

  async function handleRegenerate() {
    if (!currentCard) return

    try {
      toast.loading('Regenerating card...', { id: 'regenerate' })

      const response = await fetch(`/api/cards/${currentCard.id}/regenerate`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to regenerate card')
      }

      const data = await response.json()
      
      // Update local card state
      setLocalCards(prev => prev.map(card => 
        card.id === currentCard.id 
          ? { ...card, frontEdited: data.row.frontEdited, backEdited: data.row.backEdited, isEdited: true }
          : card
      ))

      toast.success('Card regenerated!', { id: 'regenerate' })
    } catch (error: any) {
      toast.error(error.message, { id: 'regenerate' })
    }
  }

  function handleEditClick() {
    if (!currentCard) return
    setEditFront(currentCard.isEdited && currentCard.frontEdited ? currentCard.frontEdited : currentCard.front)
    setEditBack(currentCard.isEdited && currentCard.backEdited ? currentCard.backEdited : currentCard.back)
    setShowEdit(true)
  }

  async function handleSaveEdit() {
    if (!currentCard) return

    try {
      const response = await fetch(`/api/cards/${currentCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front: editFront,
          back: editBack,
          isEdited: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save edits')
      }

      const data = await response.json()
      
      // Update local card state
      setLocalCards(prev => prev.map(card => 
        card.id === currentCard.id 
          ? { ...card, frontEdited: data.row.frontEdited, backEdited: data.row.backEdited, isEdited: true }
          : card
      ))

      toast.success('Card edited!')
      setShowEdit(false)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  function nextCard(dir: number) {
    setDirection(dir)
    setShowBack(false)

    // Find next unprocessed card
    let nextIndex = currentIndex + 1
    while (nextIndex < localCards.length && processedCards.has(localCards[nextIndex].id)) {
      nextIndex++
    }

    if (nextIndex < localCards.length) {
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
            You've reviewed all {localCards.length} cards
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
                {localCards.length - acceptedCount} cards discarded
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={async () => {
                  if (importing) return
                  setImporting(true)
                  try {
                    const response = await fetch(`/api/runs/${runId}/import`, {
                      method: 'POST',
                    })
                    if (!response.ok) {
                      const data = await response.json()
                      throw new Error(data.error || 'Failed to import')
                    }
                    const data = await response.json()
                    toast.success(`Imported ${data.imported} cards to Anki!${data.skipped ? ` (${data.skipped} already imported)` : ''}`)
                  } catch (error: any) {
                    toast.error(error.message || 'Failed to import cards')
                  } finally {
                    setImporting(false)
                  }
                }}
                disabled={importing}
              >
                {importing ? 'Importing...' : 'Import to Anki'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await fetch(`/runs/${runId}/download`)
                    if (!response.ok) {
                      throw new Error('Failed to download file')
                    }
                    
                    const blob = await response.blob()
                    const url = window.URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    
                    const contentDisposition = response.headers.get('Content-Disposition')
                    let filename = 'notes.apkg'
                    if (contentDisposition) {
                      const filenameMatch = contentDisposition.match(/filename="(.+)"/)
                      if (filenameMatch) {
                        filename = filenameMatch[1]
                      }
                    }
                    
                    a.download = filename
                    document.body.appendChild(a)
                    a.click()
                    window.URL.revokeObjectURL(url)
                    document.body.removeChild(a)
                    
                    toast.success('Download started!')
                  } catch (error: any) {
                    console.error('Download error:', error)
                    toast.error(error.message || 'Failed to download file')
                  }
                }}
              >
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

  const displayFront = currentCard.isEdited && currentCard.frontEdited ? currentCard.frontEdited : currentCard.front
  const displayBack = currentCard.isEdited && currentCard.backEdited ? currentCard.backEdited : currentCard.back

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Card {currentIndex + 1} of {localCards.length}
          </span>
          <span className="text-muted-foreground">
            {acceptedCount} accepted • {remainingCards} remaining
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="text-xs text-slate-500 text-center">{reviewedCount}/{total}</div>
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
              <div className="relative h-[420px] w-full [transform-style:preserve-3d]">
                {/* FRONT - Always in DOM for MathJax */}
                <div 
                  className={`absolute inset-0 backface-hidden flex items-center justify-center p-6 text-center ${showBack ? 'hidden' : ''}`}
                >
                  <div className="w-full">
                    <div className="text-center mb-4">
                      <Badge variant="secondary">Front</Badge>
                    </div>
                    <MathText
                      text={displayFront}
                      nonce={`${currentCard.id}-front-${showBack ? '1' : '0'}`}
                      className="prose prose-sm max-w-none text-center"
                    />
                  </div>
                </div>
                {/* BACK - Always in DOM for MathJax */}
                <div 
                  className={`absolute inset-0 backface-hidden flex items-center justify-center p-6 text-center ${!showBack ? 'hidden' : ''}`}
                >
                  <div className="w-full">
                    <div className="text-center mb-4">
                      <Badge variant="secondary">Back</Badge>
                    </div>
                    <MathText
                      text={displayBack}
                      nonce={`${currentCard.id}-back-${showBack ? '1' : '0'}`}
                      className="prose prose-sm max-w-none text-center"
                    />
                  </div>
                </div>
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
          disabled={busyCardId === currentCard?.id}
        >
          <XCircle className="h-5 w-5 mr-2" />
          Discard (D)
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleRegenerate}
          disabled={busyCardId === currentCard?.id}
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Regenerate (R)
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={handleEditClick}
          disabled={busyCardId === currentCard?.id}
        >
          <Edit className="h-5 w-5 mr-2" />
          Edit (E)
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={handleAccept}
          disabled={busyCardId === currentCard?.id}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          Accept (A)
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Click card or press Space to flip • Use A/D/R/E keys for actions
      </p>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Front</label>
              <Textarea
                value={editFront}
                onChange={(e) => setEditFront(e.target.value)}
                className="min-h-[150px] font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Back</label>
              <Textarea
                value={editBack}
                onChange={(e) => setEditBack(e.target.value)}
                className="min-h-[150px] font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
