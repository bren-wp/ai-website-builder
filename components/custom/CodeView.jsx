"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Lookup from "@/data/Lookup";
import { MessagesContext } from "@/context/MessagesContext";
import Prompt from "@/data/Prompt";
import { useConvex, useMutation } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Download, Loader2Icon } from "lucide-react";
import JSZip from "jszip";

const SandpackProvider = dynamic(
  () => import("@codesandbox/sandpack-react").then((mod) => mod.SandpackProvider),
  { ssr: false }
);
const SandpackLayout = dynamic(
  () => import("@codesandbox/sandpack-react").then((mod) => mod.SandpackLayout),
  { ssr: false }
);
const SandpackCodeEditor = dynamic(
  () => import("@codesandbox/sandpack-react").then((mod) => mod.SandpackCodeEditor),
  { ssr: false }
);
const SandpackPreview = dynamic(
  () => import("@codesandbox/sandpack-react").then((mod) => mod.SandpackPreview),
  { ssr: false }
);
const SandpackFileExplorer = dynamic(
  () => import("@codesandbox/sandpack-react").then((mod) => mod.SandpackFileExplorer),
  { ssr: false }
);

const DEFAULT_FILES = Lookup?.DEFAULT_FILES ?? Lookup?.DEFAULT_FILE ?? {};
const DEFAULT_DEPENDENCIES = Lookup?.DEPENDENCIES ?? Lookup?.DEPENDANCY ?? {};

function sanitizeFilePath(path) {
  if (typeof path !== "string") return null;

  const normalized = path.replace(/\\/g, "/").trim();

  if (!normalized.startsWith("/") || normalized.includes("..")) {
    return null;
  }

  return normalized;
}

function CodeView() {
  const params = useParams();
  const workspaceId = useMemo(() => {
    const rawId = params?.id;
    return Array.isArray(rawId) ? rawId[0] : rawId;
  }, [params]);

  const [activeTab, setActiveTab] = useState("code");
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [loading, setLoading] = useState(false);

  const messagesContext = useContext(MessagesContext);
  if (!messagesContext) {
    throw new Error("CodeView must be used within a MessagesProvider.");
  }

  const { messages = [] } = messagesContext;
  const updateFiles = useMutation(api.workspace.UpdateFiles);
  const convex = useConvex();

  const hasExistingFilesRef = useRef(false);
  const lastProcessedSignatureRef = useRef(null);

  const preprocessFiles = useCallback((inputFiles) => {
    const processed = {};

    if (!inputFiles || typeof inputFiles !== "object") {
      return processed;
    }

    for (const [rawPath, content] of Object.entries(inputFiles)) {
      const safePath = sanitizeFilePath(rawPath);
      if (!safePath) continue;

      if (typeof content === "string") {
        processed[safePath] = { code: content };
        continue;
      }

      if (content && typeof content === "object") {
        if (typeof content.code === "string") {
          processed[safePath] = {
            code: content.code,
          };
          continue;
        }

        processed[safePath] = {
          code: JSON.stringify(content, null, 2),
        };
      }
    }

    return processed;
  }, []);

  const loadFiles = useCallback(async () => {
    if (!workspaceId) return;

    try {
      const result = await convex.query(api.workspace.GetWorkspace, {
        workspaceId,
      });

      const processedFiles = preprocessFiles(result?.fileData || {});
      hasExistingFilesRef.current = Object.keys(processedFiles).length > 0;

      const mergedFiles = { ...DEFAULT_FILES, ...processedFiles };
      setFiles(mergedFiles);
    } catch (error) {
      console.error("Failed to load files:", error);
      setFiles(DEFAULT_FILES);
    }
  }, [workspaceId, convex, preprocessFiles]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const generateAiCode = useCallback(
    async (promptMessages) => {
      if (!workspaceId || !Array.isArray(promptMessages) || promptMessages.length === 0) {
        return;
      }

      setLoading(true);

      try {
        const response = await fetch("/api/gen-ai-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: `${Prompt.CODE_GEN_PROMPT}\n\n${JSON.stringify(promptMessages)}`,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("Code generation stream is unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let finalData = null;

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

              if (payload?.done && payload?.final && typeof payload.final === "object") {
                finalData = payload.final;
              }
            } catch {
              // ignore malformed stream events
            }
          }
        }

        if (finalData?.files && typeof finalData.files === "object") {
          const processedAiFiles = preprocessFiles(finalData.files);
          const mergedFiles = { ...DEFAULT_FILES, ...processedAiFiles };

          setFiles(mergedFiles);
          hasExistingFilesRef.current = Object.keys(processedAiFiles).length > 0;

          await updateFiles({
            workspaceId,
            files: processedAiFiles,
          });
        }
      } catch (error) {
        console.error("Error generating AI code:", error);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, preprocessFiles, updateFiles]
  );

  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0 || loading) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "user") return;

    const signature = `${messages.length}:${lastMessage.content}`;

    if (lastProcessedSignatureRef.current === null && hasExistingFilesRef.current) {
      lastProcessedSignatureRef.current = signature;
      return;
    }

    if (lastProcessedSignatureRef.current === signature) {
      return;
    }

    lastProcessedSignatureRef.current = signature;
    void generateAiCode(messages);
  }, [messages, loading, generateAiCode]);

  const downloadFiles = useCallback(async () => {
    try {
      const zip = new JSZip();

      for (const [rawFilename, content] of Object.entries(files)) {
        const safePath = sanitizeFilePath(rawFilename);
        if (!safePath) continue;

        let fileContent = "";

        if (typeof content === "string") {
          fileContent = content;
        } else if (content && typeof content === "object") {
          fileContent =
            typeof content.code === "string"
              ? content.code
              : JSON.stringify(content, null, 2);
        }

        if (!fileContent) continue;

        zip.file(safePath.slice(1), fileContent);
      }

      const packageJson = {
        name: "generated-project",
        version: "1.0.0",
        private: true,
        scripts: {
          dev: "vite",
          build: "vite build",
          preview: "vite preview",
        },
        dependencies: DEFAULT_DEPENDENCIES,
      };

      zip.file("package.json", JSON.stringify(packageJson, null, 2));

      const blob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(blob);

      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "project-files.zip";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } finally {
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error downloading files:", error);
    }
  }, [files]);

  return (
    <div className="relative">
      <div className="w-full border bg-[#181818] p-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex w-[140px] shrink-0 flex-wrap items-center justify-center gap-3 rounded-full bg-black p-1">
            <button
              type="button"
              onClick={() => setActiveTab("code")}
              className={`rounded-full px-2 py-1 text-sm transition ${
                activeTab === "code"
                  ? "bg-blue-500/25 text-blue-500"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Code
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`rounded-full px-2 py-1 text-sm transition ${
                activeTab === "preview"
                  ? "bg-blue-500/25 text-blue-500"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              Preview
            </button>
          </div>

          <button
            type="button"
            onClick={downloadFiles}
            disabled={loading}
            className="flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-white transition-colors duration-200 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            <span>Download Files</span>
          </button>
        </div>
      </div>

      <SandpackProvider
        files={files}
        template="react"
        theme="dark"
        customSetup={{
          dependencies: {
            ...DEFAULT_DEPENDENCIES,
          },
          entry: "/main.jsx",
        }}
        options={{
          externalResources: ["https://cdn.tailwindcss.com"],
          bundlerTimeoutSecs: 120,
          recompileMode: "immediate",
          recompileDelay: 300,
        }}
      >
        <div className="relative">
          <SandpackLayout>
            {activeTab === "code" ? (
              <>
                <SandpackFileExplorer style={{ height: "80vh" }} />
                <SandpackCodeEditor
                  style={{ height: "80vh" }}
                  showTabs
                  showLineNumbers
                  showInlineErrors
                  wrapContent
                />
              </>
            ) : (
              <SandpackPreview
                style={{ height: "80vh" }}
                showNavigator
                showOpenInCodeSandbox={false}
                showRefreshButton
              />
            )}
          </SandpackLayout>
        </div>
      </SandpackProvider>

      {loading && (
        <div className="absolute top-0 flex h-full w-full items-center justify-center rounded-lg bg-gray-900/80 p-10">
          <div className="flex items-center gap-3">
            <Loader2Icon className="h-10 w-10 animate-spin text-white" />
            <h2 className="text-white">Generating files...</h2>
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeView;
