import { Platform } from "react-native";

/**
 * Cross-platform text file download helper.
 * - Web: triggers a Blob download.
 * - Native: falls back to an alert with size info (caller can replace later).
 */
export function downloadTextFile(filename: string, content: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  } else {
    alert(
      content.length > 1000
        ? `Export ready (${content.length} characters). File saving coming soon.`
        : content
    );
  }
}

export default downloadTextFile;
