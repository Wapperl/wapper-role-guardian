const Discord = require("discord.js");
const client = new Discord.Client();
const mongoose = require("mongoose");
const config = require('./configke.json');

mongoose.connect(config.MongoConnectURL, {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.connection.on("connected", () => {
    console.log("[ROLEGUARD] MongoDB Connect!");
});
  
client.on("ready", () => {
    console.log(`[ROLEGUARD], ${client.user.username} Online.`);
    client.user.setPresence({ activity: { name: config.RGuardStatus }, type: 'PLAYING',  status: 'dnd'})   
    setRoleBackup();
    setInterval(() => {
      setRoleBackup();
    }, 1000*60*1); // 1 Dakika, 50 Dakika > 1000*60*50
});

const Database = require("./Schema/role.js");

function setRoleBackup() {
    let guild = client.guilds.cache.get(config.guildID);
    if (guild) {
      guild.roles.cache.filter(r => r.name !== "@everyone" && !r.managed).forEach(role => {
        let roleChannelOverwrites = [];
        guild.channels.cache.filter(c => c.permissionOverwrites.has(role.id)).forEach(c => {
          let channelPerm = c.permissionOverwrites.get(role.id);
          let pushlanacak = { id: c.id, allow: channelPerm.allow.toArray(), deny: channelPerm.deny.toArray() };
          roleChannelOverwrites.push(pushlanacak);
        });
  
        Database.findOne({guildID: config.guildID, roleID: role.id}, async (err, savedRole) => {
          if (!savedRole) {
            let newRoleSchema = new Database({
              _id: new mongoose.Types.ObjectId(),
              guildID: config.guildID,
              roleID: role.id,
              name: role.name,
              color: role.hexColor,
              hoist: role.hoist,
              position: role.position,
              permissions: role.permissions,
              mentionable: role.mentionable,
              time: Date.now(),
              members: role.members.map(m => m.id),
              channelOverwrites: roleChannelOverwrites
            });
            newRoleSchema.save();
          } else {
            savedRole.name = role.name;
            savedRole.color = role.hexColor;
            savedRole.hoist = role.hoist;
            savedRole.position = role.position;
            savedRole.permissions = role.permissions;
            savedRole.mentionable = role.mentionable;
            savedRole.time = Date.now();
            savedRole.members = role.members.map(m => m.id);
            savedRole.channelOverwrites = roleChannelOverwrites;
            savedRole.save();
          };
        });
      });
  
      Database.find({guildID: config.guildID}).sort().exec((err, roles) => {
        roles.filter(r => !guild.roles.cache.has(r.roleID) && Date.now()-r.time > 1000*60*1).forEach(r => {
          Database.findOneAndDelete({roleID: r.roleID});
        });
      });
      console.log(`[ROLEGUARD] Yedek alındı!`);
    };
  };

// Cezalandırma fonksiyonu
function cezalandir(kisiID, tur) {
  let uye = client.guilds.cache.get(config.guildID).members.cache.get(kisiID);
  if (!uye) return;
  if (tur == "ban") return uye.ban({ reason: "Rol silmeye çalıştı" }).catch();
};

client.on("roleDelete", async role => {
  const event = await role.guild.fetchAuditLogs({limit:1, type: 'ROLE_DELETE',}).then(audit => audit.entries.first());
  if (!event || !event.executor || event.executor.id  === client.user.id) return;-
  role.guild.members.ban(event.executor.id,  { reason: 'Rol silmeye çalıştı!'})
    client.channels.cache.get(config.logChannel).send(`${event.executor} (${event.executor.tag}) Tarafından ${yeniRol.name} adlı rol silindi, rolü silen üye sunucudan Banlandı. Rol tekrar oluşturuldu. Rolde olan üyelere dağıtlmaya başlandı.`)
    let yeniRol = await role.guild.roles.create({
      data: {
        name: role.name,
        color: role.hexColor,
        hoist: role.hoist,
        position: role.position,
        permissions: role.permissions,
        mentionable: role.mentionable
      },
    });

    Database.findOne({guildID: role.guild.id, roleID: role.id}, async (err, roleData) => {
      if (!roleData) return;
      setTimeout(() => {
        let kanalPermVeri = roleData.channelOverwrites;
        if (kanalPermVeri) kanalPermVeri.forEach((perm, index) => {
          let kanal = role.guild.channels.cache.get(perm.id);
          if (!kanal) return;
          setTimeout(() => {
            let yeniKanalPermVeri = {};
            perm.allow.forEach(p => {
              yeniKanalPermVeri[p] = true;
            });
            perm.deny.forEach(p => {
              yeniKanalPermVeri[p] = false;
            });
            kanal.createOverwrite(yeniRol, yeniKanalPermVeri).catch(console.error);
          }, index*1000);
        });
      }, 1000);
  
      let roleMembers = roleData.members;
      roleMembers.forEach((member, index) => {
        let uye = role.guild.members.cache.get(member);
        if (!uye || uye.roles.cache.has(yeniRol.id)) return;
        setTimeout(() => {
         await uye.roles.add(yeniRol).then(e => {console.log(`BULUNDU. ${yeniRol.name}, ${uye.user.username}`);})
        }, index*1000);
    });
 });
});

client.login(config.RGuardMain);