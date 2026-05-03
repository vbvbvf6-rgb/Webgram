import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import chatsRouter from "./chats";
import messagesRouter from "./messages";
import walletRouter from "./wallet";
import pollsRouter from "./polls";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/chats/:chatId/messages", messagesRouter);
router.use("/chats/:chatId/polls", pollsRouter);
router.use("/chats", chatsRouter);
router.use("/wallet", walletRouter);
router.use("/ai", aiRouter);

export default router;
