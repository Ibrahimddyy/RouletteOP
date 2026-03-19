import TelegramBot from "node-telegram-bot-api";
import express from 'express';

// 1. إعداد السيرفر لضمان بقاء البوت Active على Railway
const app = express();
app.get('/', (req, res) => res.send('Roulette Bot is Online!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 2. إعداد البوت
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing!");

const bot = new TelegramBot(token, { polling: true });

// مخزن البيانات المؤقت
let participants: Map<number, string> = new Map(); 
let isJoinable = false;

// دالة مساعدة لحذف الرسائل لتجنب توقف البوت في حال نقص الصلاحيات
const safeDelete = async (chatId: number, messageId: number) => {
  try {
    await bot.deleteMessage(chatId, messageId.toString());
  } catch (e) {
    console.error("فشل حذف الرسالة: تأكد من صلاحيات المشرف.");
  }
};

// --- [ أمر البداية /start ] ---
bot.onText(/\/start/, async (msg: any) => {
  await bot.sendMessage(msg.chat.id, "🏰 **أهلاً بك في بوت الروليت الملكي**\nاستخدم `/rou` لبدء جولة حماسية!", { parse_mode: 'Markdown' });
});

// --- [ أمر الروليت /rou و /roul ] ---
bot.onText(/\/(rou|roul)/, async (msg: any) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  // حذف رسالة الأمر فوراً لإبقاء المجموعة نظيفة
  await safeDelete(chatId, messageId);

  if (isJoinable) {
    const tempMsg = await bot.sendMessage(chatId, "⚠️ هناك جولة قائمة بالفعل، انتظر انتهائها.");
    setTimeout(() => safeDelete(chatId, tempMsg.message_id), 3000);
    return;
  }

  participants.clear();
  isJoinable = true;

  const opts = {
    reply_markup: {
      inline_keyboard: [[{ text: "🎰 دخول الجولة (0 مشارك)", callback_data: "join_roulette" }]]
    }
  };

  const mainMsg = await bot.sendMessage(chatId, "📌 **بدأت جولة روليت جديدة!**\nأمامكم **60 ثانية** للانضمام قبل اختيار الفائز:", { parse_mode: 'Markdown', ...opts });

  // مؤقت إنهاء الجولة واختيار الفائز تلقائياً بعد دقيقة
  setTimeout(async () => {
    isJoinable = false;
    
    if (participants.size === 0) {
      await bot.editMessageText("❌ انتهى الوقت ولم يشارك أحد في هذه الجولة.", { chat_id: chatId, message_id: mainMsg.message_id });
      return;
    }

    const members = Array.from(participants.values());
    const winner = members[Math.floor(Math.random() * members.length)];

    await bot.editMessageText(`🏁 **انتهت الجولة بنجاح!**\n\n👥 عدد المشاركين: ${participants.size}\n🏆 الفائز المحظوظ هو: **${winner}**\n\nتهانينا للفائز! 🎉`, { 
      chat_id: chatId, 
      message_id: mainMsg.message_id,
      parse_mode: 'Markdown' 
    });
  }, 60000); 
});

// --- [ معالجة ضغطات الأزرار ] ---
bot.on("callback_query", async (query: any) => {
  const userId = query.from.id;
  const name = query.from.first_name || "مشارك";

  if (query.data === "join_roulette") {
    if (!isJoinable) return bot.answerCallbackQuery(query.id, { text: "انتهى وقت الانضمام! ⏳", show_alert: true });
    if (participants.has(userId)) return bot.answerCallbackQuery(query.id, { text: "أنت مسجل بالفعل! ✅" });

    participants.set(userId, name);
    
    await bot.editMessageReplyMarkup({
      inline_keyboard: [[{ text: `🎰 دخول الجولة (${participants.size} مشارك)`, callback_data: "join_roulette" }]]
    }, { chat_id: query.message.chat.id, message_id: query.message.message_id });

    await bot.answerCallbackQuery(query.id, { text: "تم تسجيلك في الجولة! 🎟️" });
  }
});

// --- [ أمر الإلغاء وحذف الرسائل /can ] ---
bot.onText(/\/(can|cancel)/, async (msg: any) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;

  await safeDelete(chatId, messageId);
  const infoMsg = await bot.sendMessage(chatId, "❌ تم تنظيف الدردشة وإلغاء الطلب.");
  setTimeout(() => safeDelete(chatId, infoMsg.message_id), 4000);
});
