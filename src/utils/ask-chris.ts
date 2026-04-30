export function askChris(prompt: string) {
  window.dispatchEvent(
    new CustomEvent("chris:ask", { detail: { prompt } }),
  );
}
