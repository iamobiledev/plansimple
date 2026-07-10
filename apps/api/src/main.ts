import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.PUBLIC_WEB_URL || "http://localhost:5173").split(","),
    credentials: true,
  });

  const port = Number(process.env.API_PORT || 3000);
  await app.listen(port, "0.0.0.0");
  Logger.log(`PlanSimple API listening on :${port}`, "Bootstrap");
}

bootstrap();
