import init, { WasmTokenizer } from "@visheratin/tokenizers";
import { SessionParams } from "./sessionParams.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { decompress } from "brotli-compress";

function typedArrayToBuffer(array: Uint8Array): ArrayBuffer {
  return array.buffer.slice(
    array.byteOffset,
    array.byteLength + array.byteOffset
  );
}

export class Tokenizer {
  instance: WasmTokenizer | undefined;
  private tokenizerPath: string;

  constructor(tokenizerPath: string) {
    this.tokenizerPath = tokenizerPath;
  }

  fetchData = async (modelPath: string): Promise<any> => {
    let blob: any = await fetch(modelPath).then((resp) => resp.arrayBuffer());
    blob = await decompress(Buffer.from(blob));
    blob = Buffer.from(typedArrayToBuffer(blob));
    blob = JSON.parse(blob);
    blob = JSON.parse(blob);

    return blob;
  };

  async init() {
    await init(SessionParams.tokenizersPath);
    const tokenizerData = await this.fetchData(this.tokenizerPath);
    tokenizerData["padding"] = null;
    this.instance = new WasmTokenizer(JSON.stringify(tokenizerData));
  }

  decode(ids: Uint32Array, skip_special_tokens: boolean): string {
    if (this.instance === undefined) {
      throw new Error("Tokenizer is not initialized");
    }
    return this.instance.decode(ids, skip_special_tokens);
  }

  encode(text: string, add_special_tokens: boolean): Uint32Array {
    if (this.instance === undefined) {
      throw new Error("Tokenizer is not initialized");
    }
    return this.instance.encode(text, add_special_tokens);
  }
}
