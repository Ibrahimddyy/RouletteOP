import asyncio
import random
import os
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes

# جلب التوكن من إعدادات Railway
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

rounds = {}
round_stack = {}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = """
🎰 **بوت الروليت الاحترافي** 🎰

الأمر الأساسي: `/rou`
الخيارات (كلها اختيارية ويمكن دمجها):
• `1m` أو `1h`: وقت الجولة.
• `2w`: عدد الفائزين (مثلاً 2 فائزين).
• `sig` + الرمز: اشتراط وجود شعار بالاسم (مثال: `sig ❦`).
• `del` + اليوزر: منع شخص من هذه الجولة (مثال: `del @user`).
• `entr`: إرسال قائمة المشاركين لك في الخاص.

مثال شامل:
`/rou 2m 3w sig ❦ del @ali entr`
"""
    await update.message.reply_text(msg, parse_mode="Markdown")

def parse_args(args):
    duration = 60  # افتراضي دقيقة
    winners = 1    # افتراضي فائز واحد
    sig = None
    banned = set()
    entr = False

    i = 0
    while i < len(args):
        a = args[i].lower()
        if a.endswith("m"):
            try: duration = int(a[:-1]) * 60
            except: pass
        elif a.endswith("h"):
            try: duration = int(a[:-1]) * 3600
            except: pass
        elif a.endswith("w"):
            try: winners = int(a[:-1])
            except: pass
        elif a == "entr":
            entr = True
        elif a == "sig":
            if i + 1 < len(args):
                sig = args[i+1]
                i += 1
        elif a == "del":
            if i + 1 < len(args):
                # تخزين اليوزر بدون @ للمقارنة السهلة
                banned.add(args[i+1].replace("@", ""))
                i += 1
        i += 1
    return duration, winners, sig, banned, entr

async def rou(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try: await update.message.delete()
    except: pass

    chat_id = update.effective_chat.id
    args = context.args
    duration, winners, sig, banned, entr = parse_args(args)
    round_id = random.randint(100000, 999999)

    rounds[round_id] = {
        "chat_id": chat_id,
        "users": {},
        "winners": winners,
        "sig": sig,
        "banned": banned,
        "entr": entr,
        "msg_id": None,
        "creator_id": update.effective_user.id
    }

    round_stack.setdefault(chat_id, []).append(round_id)

    # بناء رسالة المشاركة ديناميكياً
    text = f"🎰 **جولة روليت جديدة**\n"
    text += f"⏱ الوقت: `{duration//60}` دقيقة\n"
    if winners > 1:
        text += f"🏆 سيتم سحب `{winners}` فائزين\n"
    if sig:
        text += f"🛡 المتطلبات: وجود الشعار ( {sig} ) في اسمك\n"
    if entr:
        text += f"📝 سيتم تسجيل النتائج وإرسالها للمنظم\n"

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"مشاركة (0)", callback_data=f"join_{round_id}")]
    ])

    msg = await context.bot.send_message(chat_id, text, reply_markup=keyboard, parse_mode="Markdown")
    rounds[round_id]["msg_id"] = msg.message_id
    asyncio.create_task(end_round(context, round_id, duration))

async def join(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    user = query.from_user
    round_id = int(query.data.split("_")[1])
    r = rounds.get(round_id)

    if not r:
        await query.answer("انتهت هذه الجولة")
        return

    # رابعاً: شرط المنع (del)
    if user.username and user.username in r["banned"]:
        await query.answer("للاسف تم منعك من المشاركة في هذه الجوله", show_alert=True)
        return

    # ثالثاً: شرط الشعار (sig)
    if r["sig"] and r["sig"] not in user.full_name:
        await query.answer(f"يجب عليك وضع الشعار ( {r['sig']} ) في اسمك للمشاركة", show_alert=True)
        return

    if user.id in r["users"]:
        await query.answer("أنت مشارك بالفعل!")
        return

    r["users"][user.id] = user.username or user.full_name
    count = len(r["users"])
    keyboard = InlineKeyboardMarkup([[InlineKeyboardButton(f"مشاركة ({count})", callback_data=f"join_{round_id}")]])
    await query.edit_message_reply_markup(reply_markup=keyboard)

async def end_round(context, round_id, duration):
    await asyncio.sleep(duration)
    r = rounds.get(round_id)
    if not r: return

    users = list(r["users"].items())
    winners_list = random.sample(users, min(len(users), r["winners"])) if users else []

    if winners_list:
        winner_texts = [f"👤 [@{u}](tg://user?id={i})" if u else f"👤 [مستخدم](tg://user?id={i})" for i, u in winners_list]
        text = "🏁 **انتهت الجولة**\n\n🎊 **الفائزين:**\n" + "\n".join(winner_texts)
    else:
        text = "🏁 **انتهت الجولة**\n\nلا يوجد مشاركين."

    await context.bot.send_message(r["chat_id"], text, parse_mode="Markdown")
    try: await context.bot.delete_message(r["chat_id"], r["msg_id"])
    except: pass

    # خامساً: إرسال القائمة للخاص (entr)
    if r["entr"] and users:
        try:
            report_text = "📋 **قائمة المشاركين في الجولة:**\n\n" + "\n".join([f"👤 [@{u}](tg://user?id={i})" if u else f"👤 [مستخدم](tg://user?id={i})" for i, u in users])
            await context.bot.send_message(r["creator_id"], report_text, parse_mode="Markdown")
        except: pass

    rounds.pop(round_id, None)

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id in round_stack and round_stack[chat_id]:
        rid = round_stack[chat_id].pop()
        r = rounds.pop(rid, None)
        if r:
            try: await context.bot.delete_message(chat_id, r["msg_id"])
            except: pass
            await update.message.reply_text("تم إلغاء الجولة بنجاح.")

def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("rou", rou))
    app.add_handler(CommandHandler("can", cancel))
    app.add_handler(CallbackQueryHandler(join))
    app.run_polling()

if __name__ == "__main__":
    main()
    
