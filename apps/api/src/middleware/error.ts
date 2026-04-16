import type { NextFunction, Request, Response } from "express";
import multer from "multer";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ message: "File too large. Maximum size is 10 MB." });
      return;
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ message: "Too many files. Maximum is 5 files per upload." });
      return;
    }
    res.status(400).json({ message: `Upload error: ${err.message}` });
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(500).json({ message });
}
