import { env } from "../config/env.js";

export function uploadMedia(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.status(201).json({
      data: {
        url: req.file.path,
        public_id: req.file.filename,
        format: req.file.format,
        width: req.file.width,
        height: req.file.height,
      },
    });
  } catch (err) {
    next(err);
  }
}

export function getConfig(req, res) {
  res.json({
    data: {
      whatsappNumber: env.whatsappNumber,
    },
  });
}
