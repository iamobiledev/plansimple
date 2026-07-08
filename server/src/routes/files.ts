import { Router } from "express";
import { requireAuth } from "../auth.js";
import { storage } from "../storage/storage.js";

const router = Router();
router.use(requireAuth);

router.get("/:key", async (req, res) => {
  try {
    const data = await storage.load(req.params.key);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(data);
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
