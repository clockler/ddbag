var Discord = require("discordie"),
	Parser = require("./src/parser.js"),
	Log = require("./src/logger.js"),
	Package = JSON.parse(require("fs").readFileSync("./package.json", {"encoding": "utf-8"})),
	Token = require("fs").readFileSync("./token", {"encoding": "utf-8"});

// Bot add URL
//   https://discordapp.com/api/oauth2/authorize?client_id=282751290029899776&scope=bot&permissions=67488832
// Permissions:
//   Add reactions         0x00000040 *
//   Read messages         0x00000400
//   Send messages         0x00000800
//   Embed links           0x00004000 *
//   Attach files          0x00008000 *
//   Read message history  0x00010000 *
//   Use external emoji    0x00040000 *
//   Change nickname       0x04000000 *
// Sum = 67488832

var Client = new Discord({
	// "shardId": 0,
	// "shardCount": 1,

	"autoReconnect": true,
	"delay": 5000
});

Client.Dispatcher.on("GATEWAY_READY", e => {
	Log.Network("Connected");
	Log.Status("In " + Client.Guilds.length + " guilds");
});
Client.Dispatcher.on("GUILD_CREATE", e => {
	if(!e.becameAvailable)
	{
		Log.Status("Added to guild '" + e.guild.name + "'");
		Log.Status("In " + Client.Guilds.length + " guilds");
	}
})
Client.Dispatcher.on("GATEWAY_RESUMED", e => {
	Log.Network("Resumed");
});
Client.Dispatcher.on("DISCONNECTED", e => {
	Log.Network("Disconnected: " + e.error.message);
});
Client.Dispatcher.on("MESSAGE_CREATE", e => {
	var message = e.message,
		content = e.message.resolveContent(),
		name = e.message.author.username + "#" + e.message.author.discriminator,
		member = Client.User.memberOf(e.message.guild),
		mentioned = message.channel.isDM || Client.User.isMentioned(message, true);
	if(mentioned)
	{
		content = content.replace("@" + member.nick, "").replace("@" + member.username, "").trim();
		Log.Debug(name + ": " + content);
		if(content.length > 0)
		{
			try {
				var res = Parser(content),
					arr = Array.isArray(res[0]),
					nam = res[1] || content,
					res = res[0];
				if(arr && res.length > 0)
				{
					Log.Debug("=> [" + res.join(", ") + "]");
					message.channel.sendMessage(nam + ": " + res.join(", "))
				}
				else
				{
					Log.Debug("=> " + res);
					message.channel.sendMessage(nam + ": " + res);
				}
			}
			catch(err)
			{
				if(err.name === "ValidationError" || err.name === "RawError")
				{
					Log.Debug("=> " + err.errorMessage());
					message.channel.sendMessage(message.author.mention + " " + err.friendlyMessage());
				}
				else
				{
					Log.Error(err.stack);
				}
			}
		}
	}
});

Client.connect({"token": Token});
Log.Debug("Started version " + Package.version);