import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim()) : true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Render can run the dashboard and API as one web service. Keeping this
// fallback here also makes the supplied ZIP deployable without a second
// frontend service.
const frontendDist = process.env.FRONTEND_DIST_PATH ?? path.resolve(process.cwd(), "artifacts/deviceguard/dist/public");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
