import TelegramBot from "node-telegram-bot-api";
import express from 'express'; // لإبقاء السيرفر شغال

// 1. إعداد السيرفر البسيط لإرضاء Railway (Health Check)
const app = express();
app.get('/', (req, res) => res.send('Roulette Bot is Online! 🚀'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 2. إعداد البوت
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing!");
const bot = new TelegramBot(token, { polling: true });

// --- أمر البداية (/start) بتنسيق فخم ---
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeText = `
🎰 **أهلاً بك في بوت الروليت الملكي** 🎰
أنا مساعدك الذكي لإدارة جولات الحظ بضغطة زر.

📜 **دليل الأوامر السريع:**
━━━━━━━━━━━━━━
🔹 \`/rou [الوقت] w[الفائزين] sig [الشعار]\`
(مثال: \`/rou 10m w3 sig ℕ\`)

🔹 \`/can\` أو \`/cancel\`
لإلغاء الجولة فوراً (بالرد على الرسالة).

⚙️ **مميزات إضافية:**
• \`del @user\` : لاستبعاد أشخاص محددين.
• \`entr\` : لاستلام قائمة المشاركين في الخاص.
━━━━━━━━━━━━━━
⚠️ **تنبيه:** يرجى رفع البوت "أدمن" لضمان حذف الأوامر تلقائياً.
    `;
    await bot.sendMessage(chatId, welcomeText, { parse_mode: "Markdown" });
});

// --- أمر الروليت (/rou) مع حذف الرسالة التلقائي ---
bot.onText(/\/rou (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const messageId = msg.message_id;

    // حذف أمر المستخدم فوراً لتنظيف المحادثة
    try {
        await bot.deleteMessage(chatId, messageId);
    } catch (e) {
        console.log("صلاحية حذف الرسائل مفقودة.");
    }

    // هنا تكتمل بقية وظائف الروليت...
    await bot.sendMessage(chatId, "✅ تم استلام طلبك وبدء الجولة!");
});

// --- أمر الإلغاء (/can) مع الحذف ---
bot.onText(/\/(can|cancel)/, async (msg) => {
    try {
        await bot.deleteMessage(msg.chat.id, msg.message_id);
    } catch (e) {}
    await bot.sendMessage(msg.chat.id, "❌ تم إلغاء الجولة بنجاح.");
});

console.log("البوت جاهز للعمل على Railway! 🚀");
