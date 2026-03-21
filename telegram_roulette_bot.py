import asyncio
import random
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes

import os
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

rounds = {}
round_stack = {}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = """
الأوامر:

/rou [options]
تشغيل جولة روليت

الخيارات:
1m / 1h → وقت الجولة
2w → عدد الفائزين
sig ❦ → شرط شعار بالاسم
del @user → منع شخص
entr → ارسال المشاركين خاص

/can → إلغاء آخر جولة
"""
    await update.message.reply_text(msg)

def parse_args(args):
    duration = 60
    winners = 1
    sig = None
    banned = set()
    entr = False

    for a in args:
        if a.endswith("m"):
            duration = int(a[:-1]) * 60
        elif a.endswith("h"):
            duration = int(a[:-1]) * 3600
        elif a.endswith("w"):
            winners = int(a[:-1])
        elif a == "entr":
            entr = True
        elif a == "sig":
            pass
        elif a.startswith("@"):
            banned.add(a)
        else:
            sig = a

    return duration, winners, sig, banned, entr

async def rou(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.delete()

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
        "msg_id": None
    }

    round_stack.setdefault(chat_id, []).append(round_id)

    text = f"جولة روليت\nالوقت: {duration//60} دقيقة\nالفائزين: {winners}"
    if sig:
        text += f"\nالشعار المطلوب: {sig}"
    if entr:
        text += f"\nسيتم تسجيل النتائج"

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"مشاركة (0)", callback_data=f"join_{round_id}")]
    ])

    msg = await context.bot.send_message(chat_id, text, reply_markup=keyboard)
    rounds[round_id]["msg_id"] = msg.message_id

    asyncio.create_task(end_round(context, round_id, duration))

async def join(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user = query.from_user
    data = query.data

    round_id = int(data.split("_")[1])
    r = rounds.get(round_id)

    if not r:
        return

    if user.username and f"@{user.username}" in r["banned"]:
        await query.answer("تم منعك من المشاركة", show_alert=True)
        return

    if r["sig"] and (not user.full_name or r["sig"] not in user.full_name):
        await query.answer(f"ضع الشعار {r['sig']} باسمك", show_alert=True)
        return

    if user.id in r["users"]:
        await query.answer("انت مشارك بالفعل")
        return

    r["users"][user.id] = user.username or user.full_name

    count = len(r["users"])

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"مشاركة ({count})", callback_data=f"join_{round_id}")]
    ])

    await query.edit_message_reply_markup(reply_markup=keyboard)

async def end_round(context, round_id, duration):
    await asyncio.sleep(duration)

    r = rounds.get(round_id)
    if not r:
        return

    users = list(r["users"].items())  # [(user_id, username_or_fullname)]
    winners = random.sample(users, min(len(users), r["winners"])) if users else []

    if winners:
        winner_texts = [
            f"[@{uname}](tg://user?id={uid})" if uname else f"[مستخدم](tg://user?id={uid})"
            for uid, uname in winners
        ]
    else:
        winner_texts = ["لا يوجد"]

    text = "انتهت الجولة\nالفائزين:\n" + "\n".join(winner_texts)

    await context.bot.send_message(r["chat_id"], text, parse_mode="Markdown")

    try:
        await context.bot.delete_message(r["chat_id"], r["msg_id"])
    except:
        pass

    if r["entr"] and users:
        try:
            await context.bot.send_message(list(r["users"].keys())[0], "\n".join(u for _, u in users))
        except:
            pass

    rounds.pop(round_id, None)

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id

    if chat_id not in round_stack or not round_stack[chat_id]:
        return

    round_id = round_stack[chat_id].pop()

    r = rounds.pop(round_id, None)
    if not r:
        return

    try:
        await context.bot.delete_message(chat_id, r["msg_id"])
    except:
        pass

def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("rou", rou))
    app.add_handler(CommandHandler("can", cancel))
    app.add_handler(CallbackQueryHandler(join))

    app.run_polling()

if __name__ == "__main__":
    main()
