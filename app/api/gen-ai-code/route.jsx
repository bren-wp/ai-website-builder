import { createCodeGenSession, safeParseJson } from "@/configs/AiModel";

const MAX_PROMPT_LENGTH = 30000;

function sse(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req) {
  let body;

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return Response.json(
      { error: "Prompt is required." },
      { status: 400 }
    );
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      { error: "Prompt is too long." },
      { status: 413 }
    );
  }

  try {
    const session = createCodeGenSession();
    const result = await session.sendMessageStream(prompt);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";

        try {
          for await (const chunk of result.stream) {
            if (req.signal.aborted) break;

            const chunkText =
              typeof chunk?.text === "function" ? chunk.text() : "";

            if (!chunkText) continue;

            fullText += chunkText;
            controller.enqueue(encoder.encode(sse({ chunk: chunkText })));
          }

          if (req.signal.aborted) {
            controller.close();
            return;
          }

          try {
            const parsedData = safeParseJson(fullText);

            controller.enqueue(
              encoder.encode(
                sse({
                  final: parsedData,
                  done: true,
                })
              )
            );
          } catch {
            controller.enqueue(
              encoder.encode(
                sse({
                  error: "Invalid JSON response from model.",
                  done: true,
                })
              )
            );
          }
        } catch {
          if (!req.signal.aborted) {
            controller.enqueue(
              encoder.encode(
                sse({
                  error: "Code generation failed.",
                  done: true,
                })
              )
            );
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json(
      { error: "Code generation request failed." },
      { status: 500 }
    );
  }
}
