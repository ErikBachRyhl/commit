"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Loader2, GitCommit, Calendar, User, AlertCircle, PlayCircle, Code2, CheckCircle2, Sparkles, AlertTriangle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

type GitCommit = {
  sha: string
  shortSha: string
  message: string
  author: string
  date: string
  dateRelative: string
}

type CommitSelectorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: string
}

export function CommitSelector({ open, onOpenChange, repoId }: CommitSelectorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [selectedMode, setSelectedMode] = useState<'latest' | 'since' | 'all'>('latest')
  const [selectedCommit, setSelectedCommit] = useState<string>('')
  const [processing, setProcessing] = useState(false)
  const [devMode, setDevMode] = useState(false)
  const [forceReprocess, setForceReprocess] = useState(false)
  const [commitStatuses, setCommitStatuses] = useState<Record<string, 'new' | 'processed' | 'needs_re_run' | 'unknown'>>({})
  const [showCommitList, setShowCommitList] = useState(false)

  useEffect(() => {
    if (open && commits.length === 0) {
      fetchCommits()
      fetchDevMode()
    }
    if (!open) {
      setShowCommitList(false)
    }
  }, [open])

  // Fetch commit statuses when devMode is enabled and commits are loaded
  useEffect(() => {
    if (devMode && commits.length > 0 && Object.keys(commitStatuses).length === 0) {
      fetchCommitStatuses(commits.map(c => c.sha))
    }
  }, [devMode, commits])

  const fetchDevMode = async () => {
    try {
      const response = await fetch('/api/settings/dev-mode-status')
      if (response.ok) {
        const data = await response.json()
        setDevMode(data.devMode || false)
      }
    } catch (error) {
      console.error('Error fetching dev mode status:', error)
    }
  }

  const fetchCommits = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/git/commits?repoId=${repoId}&limit=20`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch commits')
      }

      const data = await response.json()
      setCommits(data.commits)
      
      // Default to selecting the commit from 5 commits ago
      if (data.commits.length > 5) {
        setSelectedCommit(data.commits[4].sha)
      } else if (data.commits.length > 1) {
        setSelectedCommit(data.commits[data.commits.length - 2].sha)
      }
    } catch (error: any) {
      console.error('Error fetching commits:', error)
      toast.error(error.message || 'Failed to load commits')
    } finally {
      setLoading(false)
    }
  }

  const fetchCommitStatuses = async (commitShas: string[]) => {
    try {
      const response = await fetch('/api/commits/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitShas }),
      })

      if (response.ok) {
        const data = await response.json()
        setCommitStatuses(data.statuses || {})
      }
    } catch (error) {
      console.error('Error fetching commit statuses:', error)
      // Don't show error to user, just silently fail (status badges are optional)
    }
  }

  const getStatusBadge = (sha: string) => {
    if (!devMode) return null

    const status = commitStatuses[sha]
    if (!status) return null

    switch (status) {
      case 'new':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            New
          </Badge>
        )
      case 'processed':
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-green-500 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Processed
          </Badge>
        )
      case 'needs_re_run':
        return (
          <Badge variant="outline" className="flex items-center gap-1 border-yellow-500 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            Needs Re-run
          </Badge>
        )
      default:
        return null
    }
  }

  const handleProcess = async () => {
    setProcessing(true)
    
    try {
      const body: any = { repoId }
      
      if (selectedMode === 'since' && selectedCommit) {
        body.sinceSha = selectedCommit
        console.log('[CommitSelector] Processing since commit:', selectedCommit)
      } else if (selectedMode === 'latest') {
        // Process only the very latest commit
        body.sinceSha = commits[0]?.sha // Will process HEAD only
        console.log('[CommitSelector] Processing latest commit:', commits[0]?.sha)
      }
      // 'all' mode: no sinceSha, processes everything

      // Add force flag if dev mode is enabled and checkbox is checked
      if (devMode && forceReprocess) {
        body.force = true
        console.log('[CommitSelector] Force reprocess enabled')
      }

      console.log('[CommitSelector] Starting process with body:', body)

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      console.log('[CommitSelector] Response status:', response.status)

      if (!response.ok) {
        const error = await response.json()
        console.error('[CommitSelector] Error response:', error)
        throw new Error(error.error || 'Failed to start processing')
      }

      const data = await response.json()
      console.log('[CommitSelector] Success! Run ID:', data.runId)
      onOpenChange(false)
      router.push(`/runs/${data.runId}`)
    } catch (error: any) {
      console.error('[CommitSelector] Error starting process:', error)
      toast.error(error.message || 'Failed to start processing')
    } finally {
      setProcessing(false)
    }
  }

  const getCommitCountDescription = () => {
    if (!commits.length) return ''
    
    if (selectedMode === 'latest') {
      return 'Process only the latest commit'
    } else if (selectedMode === 'all') {
      return 'Process all commits in the repository'
    } else if (selectedMode === 'since' && selectedCommit) {
      const index = commits.findIndex(c => c.sha === selectedCommit)
      if (index >= 0) {
        return `Process ${index + 1} commit${index !== 0 ? 's' : ''} since ${commits[index].shortSha}`
      }
    }
    
    return 'Select a commit to process from'
  }

  const getProcessedCommitsWarning = () => {
    if (!devMode || forceReprocess) return null

    let commitsToCheck: string[] = []
    
    if (selectedMode === 'latest' && commits.length > 0) {
      commitsToCheck = [commits[0].sha]
    } else if (selectedMode === 'since' && selectedCommit) {
      const index = commits.findIndex(c => c.sha === selectedCommit)
      if (index >= 0) {
        commitsToCheck = commits.slice(0, index + 1).map(c => c.sha)
      }
    } else if (selectedMode === 'all') {
      commitsToCheck = commits.map(c => c.sha)
    }

    const processedCount = commitsToCheck.filter(sha => commitStatuses[sha] === 'processed').length
    
    if (processedCount === 0) return null

    const total = commitsToCheck.length
    if (processedCount === total) {
      return {
        type: 'warning' as const,
        message: `All ${total} selected commit${total !== 1 ? 's have' : ' has'} already been processed. Enable "Force Reprocess" to run again.`,
      }
    } else {
      return {
        type: 'info' as const,
        message: `${processedCount} of ${total} selected commits ${processedCount !== 1 ? 'have' : 'has'} already been processed and will be skipped. Enable "Force Reprocess" to reprocess them.`,
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Select Commit Range</DialogTitle>
          <DialogDescription>
            Choose which commits to process for flashcard generation
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center flex-1">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No commits found. Make sure your repository has commits.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <AnimatePresence mode="wait">
              {!showCommitList ? (
                <motion.div
                  key="main-view"
                  initial={{ x: 0, opacity: 1 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -100, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <div className="space-y-4">
            {/* Mode Selection */}
            <RadioGroup value={selectedMode} onValueChange={(value: any) => {
              setSelectedMode(value)
              if (value === 'since') {
                setShowCommitList(true)
              }
            }}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                <RadioGroupItem value="latest" id="latest" />
                <Label htmlFor="latest" className="flex-1 cursor-pointer">
                  <div className="font-medium">Latest commit only</div>
                  <div className="text-xs text-muted-foreground">
                    Process just the most recent commit
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                <RadioGroupItem value="since" id="since" />
                <Label htmlFor="since" className="flex-1 cursor-pointer">
                  <div className="font-medium">Since a specific commit</div>
                  <div className="text-xs text-muted-foreground">
                    Process from a selected commit (inclusive) up to the latest
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex-1 cursor-pointer">
                  <div className="font-medium">All commits</div>
                  <div className="text-xs text-muted-foreground">
                    Reprocess the entire repository
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Developer Options - Show early so it's always visible */}
            {devMode && (
              <div className="border border-border bg-muted p-3 rounded-lg">
                <div className="flex items-start gap-3">
                  <Code2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="force-reprocess"
                        checked={forceReprocess}
                        onCheckedChange={(checked) => setForceReprocess(checked as boolean)}
                      />
                      <Label htmlFor="force-reprocess" className="text-sm font-medium cursor-pointer">
                        Force Reprocess
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Override cached state and reprocess commits even if they've been processed before.
                      Useful for testing LLM prompts or verifying deleted file handling.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {getCommitCountDescription()}
              </p>
            </div>

            {/* Processed Commits Warning */}
            {(() => {
              const warning = getProcessedCommitsWarning()
              if (!warning) return null

              return (
                <div className="border border-border bg-muted p-3 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-sm">
                      {warning.message}
                    </p>
                  </div>
                </div>
              )
            })()}
                    </div>
                </motion.div>
              ) : (
                <motion.div
                  key="commit-list"
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 100, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 min-h-0 flex flex-col h-full"
                >
                  <div className="mb-4 flex-shrink-0">
                    <h3 className="text-lg font-semibold mb-1">Select Starting Commit</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Choose the commit to start processing from (inclusive)
                    </p>
                    {selectedCommit && (
                      <div className="bg-muted p-2 rounded-lg">
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const index = commits.findIndex(c => c.sha === selectedCommit)
                            if (index >= 0) {
                              return `Will process ${index + 1} commit${index !== 0 ? 's' : ''} since ${commits[index].shortSha}`
                            }
                            return ''
                          })()}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="space-y-2 pr-4 pb-2">
                      {commits.map((commit) => (
                        <Card
                          key={commit.sha}
                          className={`cursor-pointer transition-colors ${
                            selectedCommit === commit.sha
                              ? 'border-primary bg-accent'
                              : 'hover:bg-accent'
                          }`}
                          onClick={() => setSelectedCommit(commit.sha)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <GitCommit className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                  <code className="text-xs font-mono text-primary">
                                    {commit.shortSha}
                                  </code>
                                  {getStatusBadge(commit.sha)}
                                </div>
                                <p className="text-sm font-medium truncate">
                                  {commit.message}
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {commit.author}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {commit.dateRelative}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Back and Continue buttons */}
                  <div className="flex justify-between gap-3 pt-4 border-t mt-4 flex-shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCommitList(false)
                        setSelectedMode('latest')
                      }}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setShowCommitList(false)}
                      disabled={!selectedCommit}
                    >
                      Continue
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          {/* Actions - Fixed at bottom (only shown in main view) */}
          {!showCommitList && (
            <div className="flex justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={processing}
              size="lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcess}
              disabled={processing || (selectedMode === 'since' && !selectedCommit)}
              size="lg"
              className="min-w-[160px]"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Processing
                </>
              )}
            </Button>
          </div>
          )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

