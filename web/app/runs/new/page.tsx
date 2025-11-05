"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function NewRunPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const repoId = searchParams.get('repoId')

  useEffect(() => {
    if (!repoId) {
      router.push('/')
      return
    }

    async function startProcess() {
      try {
        const response = await fetch('/api/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repoId,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to start processing')
        }

        const data = await response.json()
        router.push(`/runs/${data.runId}`)
      } catch (error: any) {
        console.error('Error starting process:', error)
        toast.error(error.message || 'Failed to start processing')
        router.push('/')
      }
    }

    startProcess()
  }, [repoId, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Starting Processing Run</CardTitle>
          <CardDescription>
            Initializing the Python CLI to process your LaTeX files...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  )
}

