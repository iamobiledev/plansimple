import {
  Controller,
  Get,
  Put,
  Param,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { StorageService } from "./storage.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("storage")
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /** Key is a single encodeURIComponent'd path segment. */
  @Put("upload/:key")
  async uploadProxy(
    @Param("key") key: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const decoded = decodeURIComponent(key);
    if (!decoded || decoded.includes("..")) throw new BadRequestException("Invalid key");
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await this.storage.putObject(decoded, Buffer.concat(chunks), req.headers["content-type"]);
    res.status(200).json({ ok: true, key: decoded });
  }

  @Get("object/:key")
  async downloadProxy(@Param("key") key: string, @Res() res: Response) {
    const decoded = decodeURIComponent(key);
    if (!decoded || decoded.includes("..")) throw new BadRequestException("Invalid key");
    try {
      const buf = await this.storage.getObjectBuffer(decoded);
      if (decoded.endsWith(".webp")) res.type("image/webp");
      else if (decoded.endsWith(".json")) res.type("application/json");
      else if (decoded.endsWith(".pdf")) res.type("application/pdf");
      else res.type("application/octet-stream");
      res.send(buf);
    } catch {
      throw new NotFoundException();
    }
  }
}
