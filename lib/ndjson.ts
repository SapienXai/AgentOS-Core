export async function consumeNdjsonStream<T>(
  response: Response,
  onEvent: (event: T) => Promise<void> | void
) {
  if (!response.body) {
    throw new Error("The server did not return a readable stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        await onEvent(JSON.parse(line) as T);
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();

  if (trailing) {
    await onEvent(JSON.parse(trailing) as T);
  }
}
