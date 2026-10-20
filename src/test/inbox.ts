/** An open event stream the test can feed: {@code push} raw SSE text, {@code close} to end it. */
export function streamMock() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const response = new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  return {
    response,
    /** A raw frame such as {@code "event: message\ndata: {...}\n\n"}. */
    push: (frame: string) => controller.enqueue(encoder.encode(frame)),
    close: () => controller.close(),
  };
}

/** One SSE frame for {@code event} carrying {@code data} as JSON. */
export const frame = (event: 'chat' | 'message' | 'action', data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
