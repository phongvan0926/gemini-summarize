/**
 * Gemini API Client
 * Uses Google AI Studio API Key to stream generate content via official Gemini REST API.
 */

export class GeminiApiClient {
  constructor(apiKey, model = "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateContent({ prompt, onToken, onDone, onError, signal }) {
    if (!this.apiKey) {
      onError({
        code: "NO_API_KEY",
        message: "Chưa cấu hình API Key. Vui lòng vào Cài đặt để nhập Google AI Studio API Key."
      });
      return;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096
          }
        }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || `Lỗi API (${response.status}): ${response.statusText}`;
        throw new Error(msg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep last partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                onToken(text);
              }
            } catch (e) {
              // Ignore partial JSON parse errors in SSE
            }
          }
        }
      }

      onDone();
    } catch (err) {
      if (signal && signal.aborted) return;
      onError({
        code: "API_ERROR",
        message: err.message || "Lỗi khi gọi Gemini API"
      });
    }
  }
}
