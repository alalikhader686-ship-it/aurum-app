import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Automated Telegram Bot Server API endpoint
  app.post("/api/telegram/send", async (req, res) => {
    try {
      const { botToken, chatId, text } = req.body;

      if (!botToken || !chatId || !text) {
        return res.status(400).json({ 
          success: false, 
          error: "المعلومات المطلوبة ناقصة (توكن البوت أو Chat ID أو نص الرسالة)" 
        });
      }

      console.log(`[AURUM Telegram Bot Backend] Sending message to Chat ID: ${chatId} via Bot...`);

      const targetUrl = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: text,
          parse_mode: "HTML"
        })
      });

      const data = await response.json();

      if (data.ok) {
        return res.json({ success: true, response: data.result });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: data.description || "فشل إرسال الرسالة عبر بوت التليجرام. تأكد من أن المستخدم قام بتشغيل البوت (/start) أو صحة الـ Chat ID." 
        });
      }
    } catch (err: unknown) {
      console.error("[AURUM Telegram Bot Backend Error]:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to send Telegram message";
      return res.status(500).json({ success: false, error: errorMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
