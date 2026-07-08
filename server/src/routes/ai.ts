import { Router } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const dataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg);base64,/, "Expected a base64 image data URL");

function toImageBlock(dataUrl: string): Anthropic.ImageBlockParam {
  const [header, data] = dataUrl.split(",", 2);
  const mediaType = header.includes("jpeg") ? "image/jpeg" : "image/png";
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data },
  };
}

/** Extract the first JSON object from a model response, tolerating prose or code fences. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

const countRequestSchema = z.object({
  templateImage: dataUrlSchema,
  sheetImage: dataUrlSchema,
  sheetImageWidth: z.number().int().positive(),
  sheetImageHeight: z.number().int().positive(),
  hint: z.string().max(500).optional(),
});

const countResponseSchema = z.object({
  matches: z.array(z.object({ x: z.number(), y: z.number() })),
});

router.post("/count", async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "AI is not configured. Set ANTHROPIC_API_KEY on the server." });
    }
    const parsed = countRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid AI count request" });
    const { templateImage, sheetImage, sheetImageWidth, sheetImageHeight, hint } = parsed.data;

    const response = await client.messages.create({
      model: MODEL,
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

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const json = countResponseSchema.parse(extractJson(text));
    // Clamp to image bounds; drop anything wildly out of range.
    const matches = json.matches
      .filter((m) => m.x >= 0 && m.x <= sheetImageWidth && m.y >= 0 && m.y <= sheetImageHeight)
      .slice(0, 500);
    res.json({ matches });
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof z.ZodError || (err as Error).message === "No JSON in response") {
      return res.status(502).json({ error: "AI returned an unreadable response. Try again." });
    }
    next(err);
  }
});

const areaRequestSchema = z.object({
  regionImage: dataUrlSchema,
  regionWidth: z.number().int().positive(),
  regionHeight: z.number().int().positive(),
  clickX: z.number(),
  clickY: z.number(),
});

const areaResponseSchema = z.object({
  polygon: z.array(z.object({ x: z.number(), y: z.number() })).min(3),
});

router.post("/suggest-area", async (req, res, next) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(503).json({ error: "AI is not configured. Set ANTHROPIC_API_KEY on the server." });
    }
    const parsed = areaRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid AI area request" });
    const { regionImage, regionWidth, regionHeight, clickX, clickY } = parsed.data;

    const response = await client.messages.create({
      model: MODEL,
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

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const raw = extractJson(text) as { polygon?: unknown[] };
    if (!raw.polygon || raw.polygon.length === 0) {
      return res.json({ polygon: [] });
    }
    const json = areaResponseSchema.parse(raw);
    const polygon = json.polygon.map((p) => ({
      x: Math.min(Math.max(p.x, 0), regionWidth),
      y: Math.min(Math.max(p.y, 0), regionHeight),
    }));
    res.json({ polygon });
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof z.ZodError || (err as Error).message === "No JSON in response") {
      return res.status(502).json({ error: "AI returned an unreadable response. Try again." });
    }
    next(err);
  }
});

export default router;
