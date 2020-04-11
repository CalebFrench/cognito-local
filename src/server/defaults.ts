import { createCodeDelivery } from "../services";
import { ConsoleCodeSender } from "../services/codeDelivery/consoleCodeSender";
import { otp } from "../services/codeDelivery/otp";
import { createDataStore } from "../services/dataStore";
import { createUserPool } from "../services/userPool";
import { Router } from "../targets/router";
import { createServer, Server } from "./server";

export const createDefaultServer = async (): Promise<Server> => {
  const dataStore = await createUserPool(
    {
      UsernameAttributes: ["email"],
    },
    createDataStore
  );
  const router = Router({
    codeDelivery: createCodeDelivery(ConsoleCodeSender, otp),
    storage: dataStore,
  });

  return createServer(router);
};
