import { createEnhancePromptSession } from "@/configs/AiModel";
import Prompt from "@/data/Prompt";

const MAX_PROMPT_LENGTH = 4000;

function sse(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body.", success: false },
      { status: 400 }
    );
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return Response.json(
      { error: "Prompt is required.", success: false },
      { status: 400 }
    );
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json(
      { error: "Prompt is too long.", success: false },
      { status: 413 }
    );
  }

  try {
    const session = createEnhancePromptSession();
    const result = await session.sendMessageStream(
      `${Prompt.ENHANCE_PROMPT_RULES}\n\nOriginal prompt:\n${prompt}`
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";

        try {
          for await (const chunk of result.stream) {
            if (request.signal.aborted) break;

            const chunkText =
              typeof chunk?.text === "function" ? chunk.text() : "";

            if (!chunkText) continue;

            fullText += chunkText;
            controller.enqueue(encoder.encode(sse({ chunk: chunkText })));
          }

          if (!request.signal.aborted) {
            controller.enqueue(
              encoder.encode(
                sse({
                  enhancedPrompt: fullText.trim(),
                  done: true,
                  success: true,
                })
              )
            );
          }
        } catch {
          if (!request.signal.aborted) {
            controller.enqueue(
              encoder.encode(
                sse({
                  error: "Prompt enhancement failed.",
                  success: false,
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
      { error: "Prompt enhancement request failed.", success: false },
      { status: 500 }
    );
  }
}
