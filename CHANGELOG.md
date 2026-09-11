# mls-102027

## 2026-09-11

- `libStor.deleteFile` branches on capability: if `typeof mls.stor.localStor.deleteFile ===
  'function'`, call it and return. Studio without the method keeps the IDB trash write.
  Do not branch on host (`"Deno" in globalThis`).
