const { Client, GatewayIntentBits } = require("discord.js");
const http = require("http");

// Keep Render alive
http.createServer((req, res) => res.end("alive")).listen(process.env.PORT || 3000);

console.log("=== BOT STARTING ===");
console.log("Node Version:", process.version);
console.log("Discord.js Version:", require("discord.js").version);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// CRITICAL DEBUG
client.on("debug", (info) => {
  console.log("DEBUG:", info.substring(0, 150));
});

client.on("error", (err) => {
  console.error("CLIENT ERROR:", err.message);
});

client.on("shardError", (err) => {
  console.error("SHARD ERROR:", err.message);
});

// READY EVENT
client.once("ready", () => {
  console.log("✅ BOT IS ONLINE:", client.user.tag);
});

// LOGIN WITH MAXIMUM DEBUG
const token = process.env.DISCORD_TOKEN?.trim();
console.log("Token exists:", !!token);
console.log("Token length:", token?.length);

if (!token) {
  console.error("❌ NO TOKEN FOUND!");
  process.exit(1);
}

console.log("🔑 Logging in...");
client.login(token)
  .then(() => {
    console.log("✅ Login promise resolved!");
  })
  .catch((err) => {
    console.error("❌ Login rejected:", err.message);
    console.error("Error code:", err.code);
    process.exit(1);
  });

// Timeout if ready never fires
setTimeout(() => {
  console.error("❌ BOT NEVER BECAME READY AFTER 30s");
  console.error("WebSocket Status:", client.ws.status);
  process.exit(1);
}, 30000);