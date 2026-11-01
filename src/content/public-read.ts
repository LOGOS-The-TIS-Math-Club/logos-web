export type PublicRead<T> =
  { status: "available"; data: T } | { status: "unavailable" };

// Public sections keep failures separate from successful empty reads.
export async function readPublic<T>(
  read: () => PromiseLike<T>,
): Promise<PublicRead<T>> {
  try {
    return { status: "available", data: await read() };
  } catch {
    return { status: "unavailable" };
  }
}
