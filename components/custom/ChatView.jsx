"use client";

import { MessagesContext } from "@/context/MessagesContext";
import { Link2, Loader2Icon, Send } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useConvex, useMutation } from "convex/react";
import { useParams } from "next/navigation";
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Prompt from "@/data/Prompt";
import ReactMarkdown from "react-markdown";

const MAX_INPUT_LENGTH = 4000;
const ALLOWED_MARKDOWN_ELEMENTS = [
  "p",
  "strong",
  "em",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "h1",
  "h2",
  "h3",
  "br",
];

const MessageItem = memo(function MessageItem({ msg }) {
  const isUser = msg?.role === "user";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isUser
          ? "border-gray-700 bg-gray-800/50"
          : "border-gray-700 bg-gray-800/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            isUser
              ? "bg-blue-500/20 text-blue-400"
              : "bg-purple-500/20 text-purple-400"
          }`}
        >
          {isUser ? "You" : "AI"}
        </div>

        <ReactMarkdown
          className="prose prose-invert max-w-none flex-1 overflow-auto"
          skipHtml
          allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
          components={{
            a: ({ node, ...props }) => (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer nofollow"
              />
            ),
          }}
        >
          {String(msg?.content ?? "")}
        </ReactMarkdown>
      </div>
    </div>
  );
});

MessageItem.displayName = "MessageItem";

function ChatView() {
  const params = useParams();
  const workspaceId = useMemo(() => {
    const rawId = params?.id;
    return Array.isArray(rawId) ? rawId[0] : rawId;
  }, [params]);

  const convex = useConvex();
  const updateWorkspace = useMutation(api.workspace.UpdateWorkspace);
  const messagesContext = useContext(MessagesContext);

  if (!messagesContext) {
    throw new Error("ChatView must be used within a MessagesProvider.");
  }

  const { messages = [], setMessages } = messagesContext;
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const result = await convex.query(api.workspace.GetWorkspace, {
        workspaceId,
      });

      setMessages(Array.isArray(result?.messages) ? result.messages : []);
    } catch (error) {
      console.error("Failed to load workspace:", error);
      setMessages([]);
    }
  }, [convex, workspaceId, setMessages]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const requestAiResponse = useCallback(
    async (promptMessages) => {
      if (!workspaceId) return;

      setLoading(true);
      const assistantIndex = promptMessages.length;
      setMessages([...promptMessages, { role: "assistant", content: "" }]);

      try {
        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `${Prompt.CHAT_PROMPT}\n\n${JSON.stringify(promptMessages)}`,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("AI response stream is unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

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
                fullText += payload.chunk;

                setMessages((prev) => {
                  const safeMessages = Array.isArray(prev)
                    ? [...prev]
                    : [...promptMessages, { role: "assistant", content: "" }];

                  safeMessages[assistantIndex] = {
                    role: "assistant",
                    content: fullText,
                  };

                  return safeMessages;
                });
              }

              if (payload?.done && typeof payload?.result === "string") {
                fullText = payload.result;
              }
            } catch {
              // ignore malformed stream events
            }
          }
        }

        const finalContent =
          fullText.trim() || "Sorry, I couldn't generate a response.";
        const finalMessages = [
          ...promptMessages,
          { role: "assistant", content: finalContent },
        ];

        setMessages(finalMessages);

        await updateWorkspace({
          workspaceId,
          messages: finalMessages,
        });
      } catch (error) {
        console.error("Error getting AI response:", error);

        const fallbackMessages = [
          ...promptMessages,
          {
            role: "assistant",
            content: "Sorry, something went wrong while generating the response.",
          },
        ];

        setMessages(fallbackMessages);

        try {
          await updateWorkspace({
            workspaceId,
            messages: fallbackMessages,
          });
        } catch (persistError) {
          console.error("Failed to persist fallback response:", persistError);
        }
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, updateWorkspace, setMessages]
  );

  const onGenerate = useCallback(async () => {
    const trimmedInput = userInput.trim();

    if (!trimmedInput || !workspaceId || loading) return;

    const safeInput = trimmedInput.slice(0, MAX_INPUT_LENGTH);
    const nextMessages = [
      ...(Array.isArray(messages) ? messages : []),
      {
        role: "user",
        content: safeInput,
      },
    ];

    setUserInput("");
    setMessages(nextMessages);

    try {
      await updateWorkspace({
        workspaceId,
        messages: nextMessages,
      });
    } catch (error) {
      console.error("Failed to persist user message:", error);
    }

    await requestAiResponse(nextMessages);
  }, [
    userInput,
    workspaceId,
    loading,
    messages,
    setMessages,
    updateWorkspace,
    requestAiResponse,
  ]);

  return (
    <div className="relative flex h-[85vh] flex-col bg-gray-900">
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="mx-auto max-w-4xl space-y-4">
          {Array.isArray(messages) &&
            messages.map((msg, index) => (
              <MessageItem key={`${msg?.role}-${index}`} msg={msg} />
            ))}

          {loading && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
              <div className="flex items-center gap-3 text-gray-400">
                <Loader2Icon className="h-5 w-5 animate-spin" />
                <p className="font-medium">Generating response...</p>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-gray-800 bg-gray-900/50 p-4 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
            <div className="flex gap-3">
              <textarea
                placeholder="Type your message here..."
                value={userInput}
                onChange={(event) =>
                  setUserInput(event.target.value.slice(0, MAX_INPUT_LENGTH))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void onGenerate();
                  }
                }}
                disabled={loading}
                className="h-32 w-full resize-none rounded-xl border border-gray-700 bg-gray-900/50 p-4 text-white outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={!userInput.trim() || loading}
                className="flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 transition-all duration-200 hover:from-blue-600 hover:to-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-6 w-6 text-white" />
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <Link2 className="h-5 w-5 text-gray-400 transition-colors duration-200 hover:text-gray-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatView;
