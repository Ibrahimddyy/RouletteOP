import TelegramBot from "node-telegram-bot-api";
import express from 'express';

const app = express();
app.get('/', (req, res) => res.send('Roulette Bot is Online!'));
app.listen(process.env.PORT || 3000);

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TOKEN MISSING");
const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = 123456789; // ضع الـ ID الخاص بك هنا

interface Participant {
    id: number;
    name: string;
    username?: string;
}

// تخزين مستقل لكل مجموعة
let globalParticipants: Map<number, Map<number, Participant>> = new Map();
let activeJours: Map<number, boolean> = new Map();
let excludedUsers: Map<number, Set<string>> = new Map(); // لتخزين اليوزرات المستبعدة (@user)

const safeDelete = (chatId: any, msgId: any) => bot.deleteMessage(chatId, msgId).catch(() => {});

// --- [ الأمر الرئيسي /rou ] ---
bot.onText(/\/(rou|roul)(.*)/, async (msg: any, match: any) => {
    const chatId = msg.chat.id;
    const args = match[2].trim().split(/\s+/); 

    await safeDelete(chatId, msg.message_id);
    if (activeJours.get(chatId)) return;

    let duration = 60000; 
    let winnersCount = 1;
    let sigIcon = "✨";
    let showEntr = false;
    let currentExcluded = new Set<string>();
    
    // تحليل الأوامر من السطر (مثال: /rou 10m w3 sig ℕ del @user1 entr)
    args.forEach((arg: string, index: number) => {
        const lowerArg = arg.toLowerCase();
        if (lowerArg.endsWith('m')) duration = parseInt(lowerArg) * 60000;
        if (lowerArg.startsWith('w')) winnersCount = parseInt(lowerArg.replace('w', '')) || 1;
        if (lowerArg === 'sig' && args[index + 1]) sigIcon = args[index + 1];
        if (lowerArg === 'entr') showEntr = true;
        if (lowerArg === 'del' && args[index + 1]) {
            currentExcluded.add(args[index + 1].replace('@', ''));
        }
    });

    globalParticipants.set(chatId, new Map());
    excludedUsers.set(chatId, currentExcluded);
    activeJours.set(chatId, true);

    let inviteText = `${sigIcon} **جولة روليت جديدة** ${sigIcon}\n\n`;
    inviteText += `⏱ **الوقت:** ${duration / 60000} دقيقة\n🏆 **الفائزين:** ${winnersCount}\n`;
    if (showEntr) inviteText += `\n⚙️ سيتم إرسال قائمة المشاركين للمطور..`;

    const opts = {
        reply_markup: {
            inline_keyboard: [[{ text: `🎰 دخول الجولة (0 مشارك)`, callback_data: "join" }]]
        }
    };

    const mainMsg = await bot.sendMessage(chatId, inviteText, { parse_mode: 'Markdown', ...opts });

    // مؤقت السحب
    setTimeout(async () => {
        if (!activeJours.get(chatId)) return; // في حال تم الإلغاء بـ /can
        activeJours.set(chatId, false);

        const currentMap = globalParticipants.get(chatId) || new Map();
        const members = Array.from(currentMap.values());
        
        if (members.length < winnersCount) {
            await bot.editMessageText(`⚠️ انتهى الوقت! عدد المشاركين غير كافٍ.`, { chat_id: chatId, message_id: mainMsg.message_id });
            return;
        }

        if (showEntr) {
            let report = `📋 **مشاركين جولة:** ${msg.chat.title || "خاص"}\n\n`;
            members.forEach((m, i) => report += `${i+1}. ${m.name} (@${m.username || 'N/A'})\n`);
            bot.sendMessage(ADMIN_ID, report).catch(() => {});
        }

        const winners = [];
        const pool = [...members];
        for (let i = 0; i < winnersCount; i++) {
            const index = Math.floor(Math.random() * pool.length);
            winners.push(pool.splice(index, 1)[0]);
        }

        const resultText = `🏁 **انتهت الجولة!**\n\n🎊 **الفائزين:**\n` +
            winners.map((w, i) => `🏅 ${i+1}. **${w.name}**`).join("\n");

        await bot.editMessageText(resultText, { chat_id: chatId, message_id: mainMsg.message_id, parse_mode: 'Markdown' });
    }, duration);
});

// --- [ أمر الإلغاء /can بالرد ] ---
bot.onText(/\/(can|cancel)/, async (msg: any) => {
    const chatId = msg.chat.id;
    await safeDelete(chatId, msg.message_id);
    if (activeJours.get(chatId)) {
        activeJours.set(chatId, false);
        bot.sendMessage(chatId, "❌ تم إلغاء الجولة الحالية فوراً.");
    }
});

// --- [ منطق الدخول والاستبعاد ] ---
bot.on("callback_query", async (query: any) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const username = query.from.username || "";

    if (query.data === "join") {
        if (!activeJours.get(chatId)) return bot.answerCallbackQuery(query.id, { text: "الجولة مغلقة!", show_alert: true });

        // التحقق من الاستبعاد السري
        const currentExcludes = excludedUsers.get(chatId);
        if (currentExcludes && currentExcludes.has(username)) {
            return bot.answerCallbackQuery(query.id, { text: "تم تسجيلك بنجاح! 🎉", show_alert: false }); // رسالة وهمية
        }

        let currentParticipants = globalParticipants.get(chatId) || new Map();
        if (currentParticipants.has(userId)) return bot.answerCallbackQuery(query.id, { text: "أنت مسجل بالفعل!" });

        currentParticipants.set(userId, { id: userId, name: query.from.first_name, username: username });
        globalParticipants.set(chatId, currentParticipants);

        bot.editMessageReplyMarkup({
            inline_keyboard: [[{ text: `🎰 دخول الجولة (${currentParticipants.size} مشارك)`, callback_data: "join" }]]
        }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
        bot.answerCallbackQuery(query.id, { text: "تم تسجيلك! ✅" });
    }
});
