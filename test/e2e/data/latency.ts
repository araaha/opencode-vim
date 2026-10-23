import type { Message } from "../support/fixture"

// Synthetic history only: enough Markdown/tool output to exercise session
// layout and painting without accessing a user's conversations.
export function latencyMessages(): Message[] {
  const messages: Message[] = []
  for (let index = 0; index < 60; index++) {
    const created = index * 3 + 1
    messages.push({
      id: `msg_latency_user_${index}`,
      type: "user",
      text: `Inspect example ${index}`,
      time: { created },
    })
    messages.push({
      id: `msg_latency_assistant_${index}`,
      type: "assistant",
      agent: "build",
      model: { providerID: "test", id: "fixture" },
      time: { created: created + 1, completed: created + 2 },
      content: [
        {
          type: "text",
          text: `## Example ${index}\n\nA synthetic response with **Markdown** and code.\n\n\`\`\`ts\n${Array.from({ length: 100 }, (_, line) => `const value${line} = ${line} + ${index}`).join("\n")}\n\`\`\``,
        },
        {
          type: "tool",
          id: `latency_tool_${index}`,
          name: "shell",
          time: { created: created + 1, completed: created + 2 },
          state: {
            status: "completed",
            input: { command: "echo synthetic-output" },
            content: [{ type: "text", text: "Synthetic output\n".repeat(100) }],
          },
        },
      ],
    })
  }
  return messages
}
