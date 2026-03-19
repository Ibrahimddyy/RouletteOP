import TelegramBot from "node-telegram-bot-api";
import express from 'express';

const app = express();
app.get('/', (req, res) => res.send('Roulette Bot is Online!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing!");

const bot = new TelegramBot(token, { polling: true });

// مخزن مؤقت للمشاركين (في الرام)
let participants: Set<number> = new Set();

bot.onText(/\/start/, async (msg: any) => {
  await bot.sendMessage(msg.chat.id, "🏰 **أهلاً بك في بوت الروليت الملكي**\nاستخدم /rou لبدء جولة جديدة.");
});

// --- أمر الروليت مع نظام الأزرار والعداد ---
bot.onText(/\/(rou|roul)/, async (msg: any) => {
  const chatId = msg.chat.id;
  participants.clear(); // تصفير القائمة لبدء جولة جديدة

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎰 دخول الجولة (0 مشارك)", callback_data: "join_roulette" }]
      ]
    }
  };

  await bot.sendMessage(chatId, "📌 **بدأت جولة روليت جديدة!**\nاضغط على الزر أدناه لتسجيل دخولك:", opts);
});

// معالجة ضغطة زر "دخول"
bot.on("callback_query", async (query: any) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;

  if (query.data === "join_roulette") {
    if (participants.has(userId)) {
      return bot.answerCallbackQuery(query.id, { text: "أنت مسجل بالفعل! ✅", show_alert: false });
    }

    participants.add(userId);
    
    // تحديث المربع (العداد) مع كل مشارك جديد
    const updatedOpts = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: `🎰 دخول الجولة (${participants.size} مشارك)`, callback_data: "join_roulette" }]
        ]
      }
    };

    try {
      await bot.editMessageReplyMarkup(updatedOpts.reply_markup, updatedOpts);
      await bot.answerCallbackQuery(query.id, { text: "تم تسجيل دخولك بنجاح! 🎉" });
    } catch (e) {
      console.error("خطأ في التحديث:", e);
    }
  }
});

// أمر الإلغاء
bot.onText(/\/(can|cancel)/, async (msg: any) => {
  try {
    await bot.deleteMessage(msg.chat.id, msg.message_id);
    await bot.sendMessage(msg.chat.id, "❌ تم الإلغاء.");
  } catch (e) {}
});
