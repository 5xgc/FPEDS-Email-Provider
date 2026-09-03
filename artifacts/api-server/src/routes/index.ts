import { Router, type IRouter } from "express";
import healthRouter from "./health";
import fpedsRouter from "./fpeds";

const router: IRouter = Router();

router.use(healthRouter);
router.use(fpedsRouter);

export default router;
