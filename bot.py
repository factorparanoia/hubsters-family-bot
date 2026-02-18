connect(DB_NAME) as db:
        await db.execute("UPDATE safe SET balance = balance + ?", (amount,))
        await db.commit()
    await log_action(f"{interaction.user} добавил {amount}$ в сейф")
    await interaction.response.send_message("Добавлено")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def safe_remove(interaction: discord.Interaction, amount:int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("UPDATE safe SET balance = balance - ?", (amount,))
        await db.commit()
    await log_action(f"{interaction.user} изъял {amount}$ из сейфа")
    await interaction.response.send_message("Изъято")

# ================= WAREHOUSE =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def warehouse_add(interaction: discord.Interaction, name:str, amount:int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
        INSERT INTO warehouse VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """,(name,amount,amount))
        await db.commit()
    await log_action(f"{interaction.user} добавил {name} x{amount}")
    await interaction.response.send_message("Добавлено")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def warehouse(interaction: discord.Interaction):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT * FROM warehouse")
        rows = await cursor.fetchall()
    text = "\n".join([f"{r[0]}: {r[1]}" for r in rows]) or "Пусто"
    await interaction.response.send_message(f"📦 Склад:\n{text}")

# ================= GUNS =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def gun_add(interaction: discord.Interaction, name:str, amount:int):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("""
        INSERT INTO guns VALUES (?,?)
        ON CONFLICT(name) DO UPDATE SET amount=amount+?
        """,(name,amount,amount))
        await db.commit()
    await log_action(f"{interaction.user} добавил оружие {name} x{amount}")
    await interaction.response.send_message("Добавлено")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def guns(interaction: discord.Interaction):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT * FROM guns")
        rows = await cursor.fetchall()
    text = "\n".join([f"{r[0]}: {r[1]}" for r in rows]) or "Нет оружия"
    await interaction.response.send_message(f"🔫 Оружие:\n{text}")

# ================= TASK SYSTEM =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def task_create(interaction: discord.Interaction, title:str, user:discord.Member):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute("INSERT INTO tasks (title,responsible,status) VALUES (?,?,?)",
                         (title,str(user),"В процессе"))
        await db.commit()
    await interaction.response.send_message("Задача создана")

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def tasks_list(interaction: discord.Interaction):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT * FROM tasks")
        rows = await cursor.fetchall()
    text = "\n".join([f"{r[0]}. {r[1]} — {r[3]}" for r in rows]) or "Нет задач"
    await interaction.response.send_message(text)

# ================= WARN SYSTEM =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def warn(interaction: discord.Interaction, user:discord.Member):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT count FROM warnings WHERE user_id=?",(user.id,))
        row = await cursor.fetchone()
        if row:
            await db.execute("UPDATE warnings SET count=count+1 WHERE user_id=?",(user.id,))
        else:
            await db.execute("INSERT INTO warnings VALUES (?,1)",(user.id,))
        await db.commit()
    await interaction.response.send_message("Выдан выговор")

# ================= GIVEAWAY =================

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def giveaway(interaction: discord.Interaction, minutes:int, winners:int, prize:str):
    await interaction.response.send_message(f"🎉 Розыгрыш: {prize} через {minutes} минут")
    await asyncio.sleep(minutes*60)
    members = interaction.guild.members
    winners_list = random.sample(members, min(winners, len(members)))
    text = "\n".join([w.mention for w in winners_list])
    await interaction.followup.send(f"🏆 Победители:\n{text}")

# ================= WEEKLY REPORT =================

@tasks.loop(hours=168)
async def weekly_report():
    channel = bot.get_channel(LOG_CHANNEL_ID)
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT balance FROM safe")
        balance = (await cursor.fetchone())[0]
    await channel.send(f"📊 Недельный отчёт\nБаланс сейфа: {balance}$")

# ================= CONTROL PANEL =================

class MainPanel(discord.ui.View):
    @discord.ui.button(label="Сейф", style=discord.ButtonStyle.green)
    async def safe_btn(self, interaction, button):
        await interaction.response.send_message("Используй /safe", ephemeral=True)

    @discord.ui.button(label="Склад", style=discord.ButtonStyle.blurple)
    async def wh_btn(self, interaction, button):
        await interaction.response.send_message("Используй /warehouse", ephemeral=True)

    @discord.ui.button(label="Оружие", style=discord.ButtonStyle.red)
    async def gun_btn(self, interaction, button):
        await interaction.response.send_message("Используй /guns", ephemeral=True)

@bot.tree.command(guild=discord.Object(id=GUILD_ID))
async def panel(interaction: discord.Interaction):
    embed = discord.Embed(
        title="👑 HUBsters Family PRO",
        description="Центр управления семьёй",
        color=0x00ff88
    )
    await interaction.response.send_message(embed=embed, view=MainPanel())

# ================= START =================

bot.run(TOKEN)
