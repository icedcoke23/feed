import "@testing-library/jest-dom";
import { TextEncoder as NodeTextEncoder } from "node:util";

// jsdom 未提供 TextEncoder，而 jose/webapi 依赖它进行 JWT 签名/验签。
// Node 的 TextEncoder 在 jsdom 环境下返回的 Uint8Array 与全局 Uint8Array
// 不在同一 realm，会导致 jose 的 instanceof 检查失败，因此需要包装为
// 当前全局的 Uint8Array 实例。
class TextEncoderPolyfill extends NodeTextEncoder {
  encode(input?: string): ReturnType<TextEncoder["encode"]> {
    return new Uint8Array(super.encode(input)) as ReturnType<
      TextEncoder["encode"]
    >;
  }
}

Object.defineProperty(globalThis, "TextEncoder", {
  value: TextEncoderPolyfill,
  writable: true,
  configurable: true,
});

let uuidCounter = 0;

Object.defineProperty(globalThis.crypto, "randomUUID", {
  value: () => {
    uuidCounter += 1;
    return `test-uuid-${uuidCounter}`;
  },
  writable: true,
  configurable: true,
});
