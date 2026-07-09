import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { apiHandler, json } from "@/server/http";
import { splitPdfIntoSheets } from "@/server/pdf-split";

export const maxDuration = 60; // splitting large plan sets can take a while

type Ctx = { params: Promise<{ projectId: string }> };

/**
 * Upload a PDF plan set to a project. Splits the PDF into one single-page
 * file per sheet, stores each, and creates Sheet rows.
 *
 * Note: on Vercel, request bodies are capped at ~4.5 MB. Larger plan sets
 * need the client-upload-to-Blob flow (future work).
 */
export const POST = apiHandler<Ctx>(async (req, { params }) => {
  const userId = await requireUserId();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!project) return json({ error: "Project not found" }, 404);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file uploaded" }, 400);
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return json({ error: "Only PDF files are supported" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let split;
  try {
    split = await splitPdfIntoSheets(buffer, file.name.replace(/\.pdf$/i, ""));
  } catch {
    return json({ error: "Could not parse PDF file" }, 400);
  }

  const existingCount = await prisma.sheet.count({ where: { projectId: project.id } });
  const sheets = [];
  for (let i = 0; i < split.length; i++) {
    const sheet = await prisma.sheet.create({
      data: {
        projectId: project.id,
        name: split[i].name,
        pageNumber: existingCount + i + 1,
        fileUrl: `/api/files/${split[i].fileKey}`,
      },
    });
    sheets.push(sheet);
  }

  return json(sheets);
});
