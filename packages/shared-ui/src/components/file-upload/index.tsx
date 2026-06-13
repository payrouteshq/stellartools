"use client";

import * as React from "react";

import { CheckCircle, ImagePlus, Pencil } from "lucide-react";
import { type DropzoneOptions, type FileRejection, useDropzone } from "react-dropzone";

import { ImageTransformer, type MimeType } from "../../integrations/image-transformer";
import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Spinner } from "../spinner";

type LabelProps = React.ComponentProps<"p">;
type ErrorProps = React.ComponentProps<"p">;

export interface FileWithPreview extends File {
  preview: string;
}

interface FileUploadProps
  extends
    MixinProps<"dropzone", Omit<DropzoneOptions, "onDrop"> & { className?: string }>,
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">> {
  id?: string;
  value?: FileWithPreview[];
  onFilesChange?: (files: FileWithPreview[]) => void;
  onFilesRejected?: (rejections: FileRejection[]) => void;
  description?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Enable automatic image transformation for web-compatible formats
   * @default false
   */
  enableTransformation?: boolean;
  /**
   * Target format for image transformation
   * @default "image/png"
   */
  targetFormat?: MimeType;
  label?: LabelProps["children"];
  error?: ErrorProps["children"];
  shape?: "square" | "circle";
  isLoading?: boolean;
  maxDimension?: number;
}

export const FileUpload = React.forwardRef<HTMLInputElement, FileUploadProps>(
  (
    {
      value = [],
      onFilesChange,
      onFilesRejected,
      placeholder = "Drag & drop an image here, or click to select",
      description,
      className,
      id,
      disabled = false,
      enableTransformation = false,
      targetFormat = "image/png",
      label,
      error,
      shape = "square",
      isLoading = false,
      maxDimension,
      ...mixinProps
    },
    ref
  ) => {
    const { dropzone, label: labelProps, error: errorProps } = splitProps(mixinProps, "dropzone", "label", "error");
    const [isTransforming, setIsTransforming] = React.useState(false);

    const onDrop = React.useCallback(
      async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
        if (acceptedFiles.length === 0) {
          if (fileRejections.length > 0) onFilesRejected?.(fileRejections);
          return;
        }

        setIsTransforming(true);
        const transformer = new ImageTransformer();

        try {
          // 1. Cleanup old previews if replacing in single mode
          if (!dropzone.multiple && value.length > 0) {
            value.forEach((file) => URL.revokeObjectURL(file.preview));
          }

          // 2. Process all files in parallel
          const processedFiles = await Promise.all(
            acceptedFiles.map(async (file) => {
              let finalFile = file;

              if (enableTransformation) {
                try {
                  finalFile = await transformer.transform(file, {
                    to: targetFormat,
                    maxDimension,
                  });
                } catch (error) {
                  console.error("Transformation failed, falling back to original:", error);
                }
              }

              return Object.assign(finalFile, {
                preview: URL.createObjectURL(finalFile),
              });
            })
          );

          const updatedFiles = dropzone.multiple ? [...value, ...processedFiles] : processedFiles;
          onFilesChange?.(updatedFiles);
        } finally {
          setIsTransforming(false);
        }

        if (fileRejections.length > 0) {
          onFilesRejected?.(fileRejections);
        }
      },
      [dropzone.multiple, value, onFilesChange, onFilesRejected, enableTransformation, targetFormat, maxDimension]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      disabled: disabled || isTransforming,
      ...dropzone,
    });

    React.useEffect(() => {
      return () => value.forEach((file) => URL.revokeObjectURL(file.preview));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const currentFile = value[0];
    const hasImage = currentFile && typeof currentFile.type === "string" && currentFile.type.startsWith("image/");
    const hasFile = !!currentFile;

    return (
      <div className={cn("w-full", className)}>
        {label && (
          <p {...labelProps} className={cn("text-sm font-medium", labelProps.className)}>
            {label}
          </p>
        )}

        <div
          {...getRootProps()}
          aria-disabled={disabled || isTransforming}
          aria-invalid={!!error}
          className={cn(
            "group border-input bg-muted/5 relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-all",
            isDragActive && "border-primary bg-primary/5 ring-primary/10 ring-4",
            (disabled || isTransforming) && "cursor-not-allowed opacity-50",
            !hasFile && !isTransforming && "hover:bg-muted/50 hover:border-primary/50",
            hasFile && !hasImage && "bg-background border-solid",
            shape == "circle" ? "size-20 rounded-full" : "h-64 w-full",
            dropzone.className
          )}
        >
          <input
            ref={ref}
            {...getInputProps({
              id,
            })}
            aria-label={typeof label === "string" ? label : "Upload file"}
            disabled={disabled || isTransforming}
            aria-invalid={!!error}
          />

          {isTransforming && (
            <div className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
              <Spinner size={32} strokeColor="var(--muted-foreground)" />
              {shape == "square" && <p className="text-sm font-medium">Processing image...</p>}
            </div>
          )}

          {isLoading && (
            <div className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
              <Spinner size={32} strokeColor="text-primary" />
            </div>
          )}

          {hasImage ? (
            <>
              <img
                key={currentFile.preview}
                src={currentFile.preview}
                alt={currentFile.name}
                className={cn("absolute inset-0 h-full w-full object-cover", shape == "circle" && "rounded-full")}
              />
              {(!disabled || !isLoading) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/40">
                  <div className="flex flex-col items-center gap-2 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
                      <Pencil className={cn(shape == "circle" ? "size-4" : "size-6")} />
                    </div>
                    {shape == "square" && <p className="text-sm font-medium">Change image</p>}
                  </div>
                </div>
              )}
            </>
          ) : hasFile ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="rounded-full bg-emerald-500 p-3">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">File successfully uploaded!</p>
                <p className="text-muted-foreground text-xs break-all">{currentFile.name}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 text-center">
              <div className="bg-background rounded-full border p-4 shadow-sm">
                <ImagePlus className="text-muted-foreground h-6 w-6" />
              </div>
              {shape == "square" && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">{placeholder}</p>
                  {description && <p className="text-muted-foreground text-xs">{description}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p {...errorProps} className={cn("text-destructive text-sm", errorProps.className)} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

FileUpload.displayName = "FileUpload";
