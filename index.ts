import TelegramBot from "node-telegram-bot-api";
import express from 'express'; // لإبقاء السيرفر شغالاً على Railway

// 1. إعداد السيرفر البسيط لإرضاء Railway (Health Check)
const app = express();
app.get('/', (req, res) => res.send('Roulette Bot is Online!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 2. إعداد البوت باستخدام التوكن من المتغيرات البيئية
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is missing in Environment Variables!");
}

const bot = new TelegramBot(token, { polling: true });

// --- ( /start ) أمر البداية بتنسيق فخم ---
bot.onText(/\/start/, async (msg: any) => {
  const chatId = msg.chat.id;
  const welcomeText = `
🏰 **أهلاً بك في بوت الروليت الملكي** 🏰
أنا مساعدك الذكي لإدارة جولات الحظ بضغطة زر.

📜 **الأوامر المتاحة:**
🔹 /rou أو /roul - لبدء جولة روليت جديدة.
🔹 /can أو /cancel - لإلغاء وحذف الرسالة.
  `;
  await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
});

// --- ( /rou أو /roul ) أمر الروليت ---
bot.onText(/\/(rou|roul)/, async (msg: any) => {
  const chatId = msg.chat.id;
  
  // ملاحظة: هنا يجب أن يكون لديك منطق لاختيار الفائز
  // الرسالة أدناه هي لتجربة استجابة الأمر
  await bot.sendMessage(chatId, "🎰 جاري فحص المشاركين لبدء الجولة...");
  
  // إذا ظهرت رسالة "نقص المشاركين"، فهذا يعني أن الكود يحتاج لبيانات مستخدمين حقيقيين في المجموعة
  console.log(` Roulette command triggered in chat: ${chatId}`);
});

// --- ( /can أو /cancel ) أمر الحذف والإلغاء ---
bot.onText(/\/(can|cancel)/, async (msg: any) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  try {
    await bot.deleteMessage(chatId, messageId.toString());
    await bot.sendMessage(chatId, "❌ تم الإلغاء وحذف الأمر بنجاح.");
  } catch (e) {
    console.error("خطأ في حذف الرسالة:", e);
  }
});

console.log("Bot system is strictly running...");
