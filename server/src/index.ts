import "dotenv/config";
import express from "express";
import session from "express-session";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import sheetRoutes from "./routes/sheets.js";
import conditionRoutes from "./routes/conditions.js";
import measurementRoutes from "./routes/measurements.js";
import aiRoutes from "./routes/ai.js";
import fileRoutes from "./routes/files.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(express.json({ limit: "50mb" }));
app.use(
  session({
    name: "plansimple.sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/sheets", sheetRoutes);
app.use("/api/conditions", conditionRoutes);
app.use("/api/measurements", measurementRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/files", fileRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`PlanSimple API listening on http://localhost:${PORT}`);
});
