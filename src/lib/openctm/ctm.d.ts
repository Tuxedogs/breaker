type CtmBody = {
  indices: Uint32Array;
  vertices: Float32Array;
  normals?: Float32Array;
  uvMaps?: Array<{ uv: Float32Array }>;
  attrMaps?: Array<{ name?: string; attr: Float32Array }>;
};

declare const CTM: {
  Stream: new (data: Uint8Array) => unknown;
  File: new (stream: unknown) => { body: CtmBody };
};

export default CTM;
