import { Canvg } from "canvg";
import { heicTo } from "heic-to";

export type MimeType = `image/${string}`;

export type TransformOptions = {
  to: MimeType;
  maxDimension?: number; // largest side (width or height)
};

export class ImageTransformer {
  async transform(file: File, { to, maxDimension }: TransformOptions): Promise<File> {
    if (file.type.toLowerCase() === to.toLowerCase() && !maxDimension) {
      return file;
    }

    try {
      const source = await this.resolveSource(file);

      const srcWidth = "naturalWidth" in source ? source.naturalWidth : (source as any).width;
      const srcHeight = "naturalHeight" in source ? source.naturalHeight : (source as any).height;

      let targetWidth = srcWidth;
      let targetHeight = srcHeight;

      // Calculate bounding box if maxDimension is provided
      if (maxDimension) {
        if (srcWidth > srcHeight) {
          if (srcWidth > maxDimension) {
            targetWidth = maxDimension;
            targetHeight = (srcHeight / srcWidth) * maxDimension;
          }
        } else {
          if (srcHeight > maxDimension) {
            targetHeight = maxDimension;
            targetWidth = (srcWidth / srcHeight) * maxDimension;
          }
        }
      }

      return await this.draw(source, file.name, to, targetWidth, targetHeight);
    } catch (err) {
      throw new Error(`Transformation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async resolveSource(file: File): Promise<CanvasImageSource> {
    const type = file.type.toLowerCase();
    const ext = file.name.split(".").pop()?.toLowerCase();

    // Handle HEIC
    if (type.includes("heic") || type.includes("heif") || ext === "heic") {
      const result = await heicTo({ blob: file, type: "image/png" });
      return result instanceof Blob
        ? this.createImageSource(URL.createObjectURL(result), true)
        : (result as ImageBitmap);
    }

    // Handle SVG
    if (type.includes("svg") || ext === "svg") {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const v = await Canvg.from(ctx, await file.text());
      await v.render();
      return canvas;
    }

    // Handle Bitmaps (WebP, PNG, JPG, etc)
    return this.createImageSource(URL.createObjectURL(file), true);
  }

  private async draw(
    source: CanvasImageSource,
    originalName: string,
    to: MimeType,
    w: number,
    h: number
  ): Promise<File> {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, to, 0.95));
    if (!blob) throw new Error("Canvas export failed");

    // Clean up file extension for the new name
    const ext = to.split("/")[1].replace("jpeg", "jpg");
    const newName = originalName.replace(/\.[^/.]+$/, "") + `.${ext}`;

    return new File([blob], newName, { type: to });
  }

  private async createImageSource(url: string, revoke: boolean): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        if (revoke) URL.revokeObjectURL(url);
        res(img);
      };
      img.onerror = () => rej(new Error("Failed to load image source"));
      img.src = url;
    });
  }
}
