import { Router, type IRouter } from "express";
import healthRouter from "./health";
import deviceGuardRouter from "./deviceguard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(deviceGuardRouter);

export default router;
