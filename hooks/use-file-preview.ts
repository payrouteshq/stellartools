import * as React from "react";

import { FileWithPreview } from "@/components/file-upload";
import { fileFromUrl } from "@/lib/utils";

export function useFilePreview(url?: string | null) {
  const [file, setFile] = React.useState<FileWithPreview | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!url) return;
    setIsLoading(true);
    setTimeout(() => console.log("loading"), 10000);
    fileFromUrl(url, "file.png").then((f) => {
      const withPreview = Object.assign(f, { preview: URL.createObjectURL(f) });
      setFile(withPreview as FileWithPreview);
      setIsLoading(false);
    });

    return () => {
      if (file?.preview) URL.revokeObjectURL(file.preview);
    };
  }, [url]);

  return { file, setFile, isLoading };
}
