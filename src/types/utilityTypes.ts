export type DeepPartial<T> = T extends (...args: infer Args) => infer Ret
  ? (...args: Args) => Ret
  : T extends ReadonlyArray<unknown>
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;
