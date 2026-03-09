"use client";

import Lookup from "@/data/Lookup";
import { MessagesContext } from "@/context/MessagesContext";
import { Link2, Sparkles, Send, Wand2, Loader2 } from "lucide-react";
import React, { useCallback, useContext, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";

const MAX_INPUT_LENGTH = 4000;

function Hero() {
  const [userInput, setUserInput] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const messagesContext = useContext(MessagesContext);
  if (!messagesContext) {
    throw new Error("Hero must be used within a MessagesProvider.");
  }

  const { setMessages } = messagesContext;
  const createWorkspace = useMutation(api.workspace.CreateWorkspace);
  const router = useRouter();

  const suggestions = useMemo(
    () => Lookup?.SUGGESTIONS ?? Lookup?.SUGGSTIONS ?? [],
    []
  );

  const onGenerate = useCallback(
    async (rawInput) => {
      const input = rawInput.trim();

      if (!input || isEnhancing || isCreating) return;

      const safeInput = input.slice(0, MAX_INPUT_LENGTH);
      const msg = {
        role: "user",
        content: safeInput,
      };

      setIsCreating(true);

      try {
        setMessages([msg]);

        const workspaceID = await createWorkspace({
          messages: [msg],
        });

        router.push(`/workspace/${workspaceID}`);
      } catch (error) {
        console.error("Error creating workspace:", error);
      } finally {
        setIsCreating(false);
      }
    },
    [isEnhancing, isCreating, setMessages, createWorkspace, router]
  );

  const enhancePrompt = useCallback(async () => {
    const trimmed = userInput.trim();
    if (!trimmed || isEnhancing || isCreating) return;

    setIsEnhancing(true);

    try {
      const response = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmed }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Prompt enhancement stream is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let enhancedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;

          try {
            const payload = JSON.parse(line.replace(/^data:\s*/, ""));

            if (typeof payload?.chunk === "string") {
              enhancedText += payload.chunk;
              setUserInput(enhancedText.slice(0, MAX_INPUT_LENGTH));
            }

            if (payload?.done && typeof payload?.enhancedPrompt === "string") {
              setUserInput(payload.enhancedPrompt.slice(0, MAX_INPUT_LENGTH));
            }
          } catch {
            // ignore malformed stream events
          }
        }
      }
    } catch (error) {
      console.error("Error enhancing prompt:", error);
    } finally {
      setIsEnhancing(false);
    }
  }, [userInput, isEnhancing, isCreating]);

  const onSuggestionClick = useCallback((suggestion) => {
    setUserInput(String(suggestion).slice(0, MAX_INPUT_LENGTH));
  }, []);

  const isBusy = isEnhancing || isCreating;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-950">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-1/2 top-0 h-[500px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle_400px_at_50%_300px,#3b82f625,transparent)]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center space-y-12">
          <div className="space-y-6 text-center">
            <div className="mb-6 inline-flex items-center justify-center space-x-2 rounded-full border border-blue-500/30 bg-blue-500/20 px-6 py-3">
              <Sparkles className="h-6 w-6 text-blue-400" />
              <span className="text-lg font-semibold tracking-wide text-blue-400">
                NEXT-GEN AI DEVELOPMENT
              </span>
            </div>

            <h1 className="bg-[linear-gradient(45deg,#60a5fa_30%,#ec4899)] bg-clip-text text-6xl font-bold leading-tight text-transparent md:text-7xl">
              Code the <br className="md:hidden" />
              Impossible
            </h1>

            <p className="mx-auto max-w-3xl text-xl tracking-tight text-cyan-300">
              Transform your ideas into production-ready UI with AI-powered assistance.
            </p>
          </div>

          <div className="w-full max-w-3xl rounded-xl border-2 border-blue-500/40 bg-gray-900/40 shadow-[0_0_40px_5px_rgba(59,130,246,0.15)] backdrop-blur-2xl">
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-2">
              <div className="rounded-lg bg-gray-900/80 p-6">
                <div className="flex gap-4">
                  <textarea
                    placeholder="DESCRIBE YOUR VISION..."
                    value={userInput}
                    onChange={(e) =>
                      setUserInput(e.target.value.slice(0, MAX_INPUT_LENGTH))
                    }
                    disabled={isBusy}
                    className="h-40 w-full resize-none rounded-lg border-2 border-blue-500/30 bg-transparent p-5 font-mono text-lg text-gray-100 outline-none transition-all duration-300 placeholder:text-blue-400/60 hover:border-blue-500/60 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  />

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => void enhancePrompt()}
                      disabled={!userInput.trim() || isBusy}
                      className="flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-4 transition-all duration-200 hover:from-emerald-600 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="Enhance prompt"
                    >
                      {isEnhancing ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <Wand2 className="h-8 w-8" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void onGenerate(userInput)}
                      disabled={!userInput.trim() || isBusy}
                      className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-4 transition-all duration-200 hover:from-blue-600 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="Generate project"
                    >
                      {isCreating ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <Send className="h-8 w-8" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Link2 className="h-6 w-6 text-blue-400/80 transition-colors duration-200 hover:text-blue-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-5xl">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  onClick={() => onSuggestionClick(suggestion)}
                  className="group relative rounded-xl border-2 border-blue-500/20 bg-gray-900/50 p-6 text-left transition-all duration-300 hover:border-blue-500/40 hover:bg-gray-800/60 hover:shadow-[0_0_20px_2px_rgba(59,130,246,0.2)]"
                >
                  <div className="absolute inset-0 rounded-lg bg-[linear-gradient(45deg,transparent_50%,#3b82f620)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="font-mono text-sm tracking-wide text-blue-400/80 transition-colors duration-300 group-hover:text-blue-400">
                    {suggestion}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Hero;
