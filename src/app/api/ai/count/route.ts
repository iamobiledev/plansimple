import { z } from "zod";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";
import {
  AI_MODEL,
  dataUrlSchema,
  extractJson,
  getAnthropicClient,
  responseText,
  toImageBlock,
} from "@/server/ai";

export const maxDuration = 60; // vision requests over a full sheet take a while

const requestSchema = z.object({
  templateImage: dataUrlSchema,
  sheetImage: dataUrlSchema,
  sheetImageWidth: z.number().int().positive(),
  sheetImageHeight: z.number().int().positive(),
  hint: z.string().max(500).optional(),
});

const responseSchema = z.object({
  matches: z.array(z.object({ x: z.number(), y: z.number() })),
});

export const POST = apiHandler(async (req) => {
  await requireUserId();
  const client = getAnthropicClient();
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid AI count request" }, 400);
  const { templateImage, sheetImage, sheetImageWidth, sheetImageHeight, hint } = parsed.data;

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "This first image is an example of a single symbol cropped from a construction drawing:" },
          toImageBlock(templateImage),
          {
            type: "text",
            text: `This second image is the full plan sheet (${sheetImageWidth}x${sheetImageHeight} pixels):`,
          },
          toImageBlock(sheetImage),
          {
            type: "text",
            text: [
              "Find every instance of the example symbol in the full plan sheet, including the original one.",
              "Match on shape, not exact pixels — symbols may be rotated or mirrored.",
              hint ? `Additional context from the user: ${hint}` : "",
              `Respond with ONLY a JSON object of the form {"matches": [{"x": <number>, "y": <number>}, ...]}`,
              `where x and y are the pixel coordinates of the CENTER of each match within the ${sheetImageWidth}x${sheetImageHeight} sheet image.`,
              "If you find no matches, respond with {\"matches\": []}. Do not include any other text.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      },
    ],
  });

  const raw = extractJson(responseText(response));
  const validated = responseSchema.safeParse(raw);
  if (!validated.success) {
    return json({ error: "AI returned an unreadable response. Try again." }, 502);
  }
  const matches = validated.data.matches
    .filter((m) => m.x >= 0 && m.x <= sheetImageWidth && m.y >= 0 && m.y <= sheetImageHeight)
    .slice(0, 500);
  return json({ matches });
});
