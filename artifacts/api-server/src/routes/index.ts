import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import chatsRouter from "./chats";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/chats/:chatId/messages", messagesRouter);
router.use("/chats", chatsRouter);

export default router;
