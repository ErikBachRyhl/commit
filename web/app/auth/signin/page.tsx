"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Github } from "lucide-react"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Commit</CardTitle>
          <CardDescription>
            Commit to your learning journey
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button 
            onClick={() => signIn("github", { callbackUrl: "/" })}
            size="lg"
            className="w-full"
          >
            <Github className="mr-2 h-5 w-5" />
            Sign in with GitHub
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Convert your LaTeX notes to Anki flashcards with AI
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

