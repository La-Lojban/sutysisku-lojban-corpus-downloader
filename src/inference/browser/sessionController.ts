import * as ort from "onnxruntime-web";
import { Session } from "./session.js";
import { SessionParams } from "./sessionParams.js";

export const createSession = async (modelPath: string): Promise<Session> => {
  ort.env.wasm.proxy = false;
  const session = new Session(SessionParams);
  await session.init(modelPath);
  return session;
};
