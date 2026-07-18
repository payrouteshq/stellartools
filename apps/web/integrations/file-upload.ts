import { AppError } from "@/lib/action-handler";
import sharp from "sharp";
import { UTApi, UTFile } from "uploadthing/server";

const api = new UTApi();

interface FileWithMetadata extends File {
  metadata?: Record<string, unknown>;
}

export const uploadFiles = async (filesWithMetadata: FileWithMetadata[], options?: { maxSizeKB?: number }) => {
  const processedFiles = await Promise.all(
    filesWithMetadata.map(async (file) => {
      if (options?.maxSizeKB && file.type.startsWith("image/")) {
        file = await compressToTarget(file, options.maxSizeKB).catch((err) => {
          console.error(`Compression failed for ${file.name}, uploading original.`, err);
          return file;
        });
      }
      return file;
    })
  );

  const utFiles = processedFiles.map(
    (file) => new UTFile([file], file.name, { customId: JSON.stringify(file.metadata) })
  );

  const response = await api.uploadFiles(utFiles);

  const errors = response.filter((file) => file.error);

  if (errors.length > 0) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to upload files: ${errors.map((file) => file.error?.message).join(", ")}`
    );
  }

  return response
    .map((file) => file.data?.ufsUrl ?? null)
    .filter((url): url is NonNullable<typeof url> => url !== null);
};

export const deleteFiles = async (fileKeys: string[]) => {
  const response = await api.deleteFiles(fileKeys);

  if (!response.success) {
    throw new AppError("INTERNAL_ERROR", `Failed to delete files: ${response.deletedCount} files not deleted`);
  }

  return true;
};

export const replaceFiles = async (oldFileKeys: string[], newFilesWithMetadata: FileWithMetadata[]) => {
  const deleted = await deleteFiles(oldFileKeys);

  if (!deleted) {
    throw new AppError("INTERNAL_ERROR", `Failed to delete files: ${oldFileKeys.join(", ")}`);
  }

  return await uploadFiles(newFilesWithMetadata);
};

// -- INTERNAL --

const compressToTarget = async (file: File, maxKB: number): Promise<File> => {
  const targetBytes = maxKB * 1024;
  const buffer = Buffer.from(await file.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 1200;

  for (let q = 85; q >= 30; q -= 10) {
    const candidate = await sharp(buffer).jpeg({ quality: q }).toBuffer();
    if (candidate.byteLength <= targetBytes) return bufferToFile(candidate, file.name, "jpeg");
  }

  for (let scale = 0.8; scale >= 0.1; scale -= 0.2) {
    const candidate = await sharp(buffer)
      .jpeg({ quality: 50 })
      .resize({ width: Math.round(originalWidth * scale), withoutEnlargement: true })
      .toBuffer();

    if (candidate.byteLength <= targetBytes) return bufferToFile(candidate, file.name, "jpeg");
  }

  const finalBuffer = await sharp(buffer)
    .resize({ width: Math.round(originalWidth * 0.1) })
    .jpeg({ quality: 20 })
    .toBuffer();

  return bufferToFile(finalBuffer, file.name, "jpeg");
};

const bufferToFile = (buffer: Buffer, originalName: string, format: "jpeg"): File => {
  const newName = originalName.replace(/\.[^/.]+$/, "") + `.${format}`;
  return new File([new Uint8Array(buffer)], newName, { type: `image/${format}` });
};
