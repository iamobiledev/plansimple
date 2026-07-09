import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { HttpError } from "./http";

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, "AI is not configured. Set ANTHROPIC_API_KEY on the server.");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const dataUrlSchema = z
  .string()
  .regex(/^data:image\/(png|jpeg);base64,/, "Expected a base64 image data URL");

export function toImageBlock(dataUrl: string): Anthropic.ImageBlockParam {
  const [header, data] = dataUrl.split(",", 2);
  const mediaType = header.includes("jpeg") ? "image/jpeg" : "image/png";
  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data },
  };
}

/** Extract the first JSON object from a model response, tolerating prose or code fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new HttpError(502, "AI returned an unreadable response. Try again.");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new HttpError(502, "AI returned an unreadable response. Try again.");
  }
}

export function responseText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
