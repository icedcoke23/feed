import "@testing-library/jest-dom";

let uuidCounter = 0;

Object.defineProperty(globalThis.crypto, "randomUUID", {
  value: () => {
    uuidCounter += 1;
    return `test-uuid-${uuidCounter}`;
  },
  writable: true,
  configurable: true,
});
