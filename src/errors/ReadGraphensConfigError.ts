export default class ReadGraphensConfigError extends Error {
  constructor(e: unknown) {
    if (e instanceof Error) {
      super(e.message, {
        cause: e.cause
      })
    } else {
      super(String(e))
    }
  }
}
