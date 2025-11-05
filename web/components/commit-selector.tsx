"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, GitCommit, Calendar, User, AlertCircle, PlayCircle } from "lucide-react"
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
  const [selectedMode, setSelectedMode] = useState<'latest' | 'since' | 'all'>('since')
  const [selectedCommit, setSelectedCommit] = useState<string>('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (open && commits.length === 0) {
      fetchCommits()
    }
  }, [open])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Commit Range</DialogTitle>
          <DialogDescription>
            Choose which commits to process for flashcard generation
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : commits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              No commits found. Make sure your repository has commits.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode Selection */}
            <RadioGroup value={selectedMode} onValueChange={(value: any) => setSelectedMode(value)}>
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
                    Process all commits after a selected commit
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

            {/* Commit List (only shown for 'since' mode) */}
            {selectedMode === 'since' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Select starting commit (will process all commits after this one):
                </Label>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="space-y-2 p-2">
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
                              <div className="flex items-center gap-2 mb-1">
                                <GitCommit className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                                <code className="text-xs font-mono text-primary">
                                  {commit.shortSha}
                                </code>
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
                </ScrollArea>
              </div>
            )}

            {/* Summary */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {getCommitCountDescription()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

