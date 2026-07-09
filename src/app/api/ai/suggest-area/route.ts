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

export const maxDuration = 60;

const requestSchema = z.object({
  regionImage: dataUrlSchema,
  regionWidth: z.number().int().positive(),
  regionHeight: z.number().int().positive(),
  clickX: z.number(),
  clickY: z.number(),
});

const responseSchema = z.object({
  polygon: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
});

export const POST = apiHandler(async (req) => {
  await requireUserId();
  const client = getAnthropicClient();
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) return json({ error: "Invalid AI area request" }, 400);
  const { regionImage, regionWidth, regionHeight, clickX, clickY } = parsed.data;

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This image is a region of a construction floor plan (${regionWidth}x${regionHeight} pixels):`,
          },
          toImageBlock(regionImage),
          {
            type: "text",
            text: [
              `The user clicked at pixel (${Math.round(clickX)}, ${Math.round(clickY)}) inside a room or enclosed space.`,
              "Trace the boundary of the enclosed room/space containing that point, following the inside face of its walls.",
              `Respond with ONLY a JSON object of the form {"polygon": [{"x": <number>, "y": <number>}, ...]}`,
              "listing the polygon vertices in order (clockwise or counterclockwise) in pixel coordinates of the image.",
              "Use as few vertices as accurately describe the boundary (typically 4-20).",
              "If you cannot identify an enclosed space, respond with {\"polygon\": []}. Do not include any other text.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const raw = extractJson(responseText(response)) as { polygon?: unknown[] };
  if (!raw.polygon || raw.polygon.length === 0) {
    return json({ polygon: [] });
  }
  const validated = responseSchema.safeParse(raw);
  if (!validated.success) {
    return json({ error: "AI returned an unreadable response. Try again." }, 502);
  }
  const polygon = validated.data.polygon.map((p) => ({
    x: Math.min(Math.max(p.x, 0), regionWidth),
    y: Math.min(Math.max(p.y, 0), regionHeight),
  }));
  return json({ polygon });
});
