// ═══════════════════════════════════════════════════════════════
//  JRLS PRODUCTION — Discord Bot
//  Met à jour le site web en temps réel via Firebase
//  
//  Installation :
//    npm install discord.js firebase-admin dotenv
//  
//  Démarrage :
//    node bot.js
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const admin = require('firebase-admin');

// ── Firebase Init ──
const serviceAccount = require('./serviceAccountKey.json'); // Téléchargé depuis Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL // ex: https://jrls-prod-default-rtdb.firebaseio.com
});

const db = admin.database();

// ── Discord Bot Init ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// ── Config ──
const PREFIX = '!';
const ADMIN_ROLE = 'Admin'; // Rôle Discord requis pour les commandes
const JRLS_GUILD_ID = process.env.GUILD_ID; // Ton server ID Discord

// ═══════════════════════════════════════════════════════════════
//  UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function isAdmin(member) {
  return member.roles.cache.some(r => r.name === ADMIN_ROLE) || 
         member.permissions.has('Administrator');
}

function parseArgs(content, prefix) {
  // Parse les arguments entre guillemets : !cmd "arg1" "arg2"
  const raw = content.slice(prefix.length).trim();
  const cmd = raw.split(/\s+/)[0].toLowerCase();
  const args = [];
  const regex = /"([^"]+)"/g;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    args.push(match[1]);
  }
  return { cmd, args };
}

function successEmbed(title, description, fields = []) {
  return new EmbedBuilder()
    .setColor(0xC9A84C)
    .setTitle(`✦ ${title}`)
    .setDescription(description)
    .addFields(fields)
    .setFooter({ text: 'JRLS Production · Site mis à jour instantanément' })
    .setTimestamp();
}

function errorEmbed(description) {
  return new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle('❌ Erreur')
    .setDescription(description);
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0xC9A84C)
    .setTitle('🎛️ JRLS Bot — Commandes disponibles')
    .setDescription('Toutes les commandes mettent à jour le site **instantanément**.')
    .addFields(
      {
        name: '📢 !annonce "Titre" "Texte"',
        value: 'Ajoute une annonce sur le site\n*Ex: !annonce "Nouveau son !" "On sort un clip vendredi"*',
        inline: false
      },
      {
        name: '🎵 !musique "Titre" "Artiste" "URLSpotify" "URLYoutube"',
        value: 'Ajoute un son dans la section musique\n*Ex: !musique "Mon Son" "JRLS" "https://spotify..." "https://youtube..."*',
        inline: false
      },
      {
        name: '🎤 !artiste "Nom" "Genre" "URLSpotify" "URLInsta" "URLYoutube"',
        value: 'Ajoute/met en avant un artiste signé\n*Ex: !artiste "KENZO" "Rap/Drill" "https://..." "" ""*',
        inline: false
      },
      {
        name: '📣 !pub "Titre" "Description" "URLImage"',
        value: 'Publie une publicité/mise en avant sur le site\n*Ex: !pub "Nouveau merch" "Collection disponible !" ""*',
        inline: false
      },
      {
        name: '🗑️ !supprimer annonce/musique/artiste/pub "ID"',
        value: 'Supprime un élément par son ID\n*Ex: !supprimer annonce "-NxK3....."*',
        inline: false
      },
      {
        name: '👁️ !status',
        value: 'Voir le contenu actuel du site',
        inline: false
      }
    )
    .setFooter({ text: '⚠️ Commandes réservées aux Admins JRLS' });
}

// ═══════════════════════════════════════════════════════════════
//  COMMANDES
// ═══════════════════════════════════════════════════════════════

async function cmdAnnonce(message, args) {
  // !annonce "Titre" "Corps du texte" ["Catégorie"]
  if (args.length < 2) {
    return message.reply({ embeds: [errorEmbed('Usage : `!annonce "Titre" "Texte"` (et optionnellement `"Catégorie"`)')] });
  }

  const [titre, texte, categorie = '📢 Annonce'] = args;
  const now = new Date();
  const data = {
    titre,
    texte,
    categorie,
    jour: now.getDate(),
    mois: now.toLocaleString('fr-FR', { month: 'short' }).toUpperCase(),
    annee: now.getFullYear(),
    timestamp: admin.database.ServerValue.TIMESTAMP
  };

  const ref = await db.ref('annonces').push(data);
  
  message.reply({
    embeds: [successEmbed(
      'Annonce publiée !',
      `L\'annonce **"${titre}"** est maintenant visible sur le site.`,
      [
        { name: 'ID', value: ref.key, inline: true },
        { name: 'Catégorie', value: categorie, inline: true },
        { name: 'Texte', value: texte.substring(0, 200), inline: false }
      ]
    )]
  });
}

async function cmdMusique(message, args) {
  // !musique "Titre" "Artiste" "URLSpotify" "URLYoutube"
  if (args.length < 2) {
    return message.reply({ embeds: [errorEmbed('Usage : `!musique "Titre" "Artiste" "URLSpotify" "URLYoutube"`')] });
  }

  const [titre, artiste, urlSpotify = '', urlYoutube = ''] = args;
  const data = {
    titre,
    artiste,
    urlSpotify,
    urlYoutube,
    emoji: '🎵',
    timestamp: admin.database.ServerValue.TIMESTAMP
  };

  const ref = await db.ref('musiques').push(data);

  message.reply({
    embeds: [successEmbed(
      'Musique ajoutée !',
      `**"${titre}"** par ${artiste} est maintenant visible sur le site.`,
      [
        { name: 'ID', value: ref.key, inline: true },
        { name: 'Spotify', value: urlSpotify || 'Non renseigné', inline: true },
        { name: 'YouTube', value: urlYoutube || 'Non renseigné', inline: true }
      ]
    )]
  });
}

async function cmdArtiste(message, args) {
  // !artiste "Nom" "Genre" "URLSpotify" "URLInsta" "URLYoutube"
  if (args.length < 2) {
    return message.reply({ embeds: [errorEmbed('Usage : `!artiste "Nom" "Genre" "URLSpotify" "URLInsta" "URLYoutube"`')] });
  }

  const [nom, genre, urlSpotify = '', urlInsta = '', urlYoutube = ''] = args;
  const data = {
    nom,
    genre,
    urlSpotify,
    urlInsta,
    urlYoutube,
    emoji: '🎤',
    signe: true,
    timestamp: admin.database.ServerValue.TIMESTAMP
  };

  const ref = await db.ref('artistes').push(data);

  message.reply({
    embeds: [successEmbed(
      'Artiste mis en avant !',
      `**${nom}** est maintenant visible dans la section Artistes du site.`,
      [
        { name: 'ID', value: ref.key, inline: true },
        { name: 'Genre', value: genre, inline: true }
      ]
    )]
  });
}

async function cmdPub(message, args) {
  // !pub "Titre" "Description" "URLImage"
  if (args.length < 2) {
    return message.reply({ embeds: [errorEmbed('Usage : `!pub "Titre" "Description" "URLImage"`')] });
  }

  const [titre, description, urlImage = ''] = args;
  const data = {
    titre,
    description,
    urlImage,
    timestamp: admin.database.ServerValue.TIMESTAMP
  };

  const ref = await db.ref('pubs').push(data);

  message.reply({
    embeds: [successEmbed(
      'Publicité publiée !',
      `La mise en avant **"${titre}"** est maintenant visible sur le site.`,
      [
        { name: 'ID', value: ref.key, inline: true },
        { name: 'Description', value: description.substring(0, 200), inline: false }
      ]
    )]
  });
}

async function cmdSupprimer(message, args) {
  // !supprimer annonce/musique/artiste/pub "ID"
  if (args.length < 1) {
    return message.reply({ embeds: [errorEmbed('Usage : `!supprimer annonce "ID"` ou musique/artiste/pub')] });
  }

  // Le type est le 2ème mot de la commande, l'ID est dans args[0]
  const content = message.content.toLowerCase();
  let type = '';
  if (content.includes('annonce')) type = 'annonces';
  else if (content.includes('musique')) type = 'musiques';
  else if (content.includes('artiste')) type = 'artistes';
  else if (content.includes('pub')) type = 'pubs';
  else return message.reply({ embeds: [errorEmbed('Type invalide. Utilise : annonce, musique, artiste ou pub')] });

  const id = args[0];
  const snap = await db.ref(`${type}/${id}`).get();
  if (!snap.exists()) {
    return message.reply({ embeds: [errorEmbed(`Aucun élément trouvé avec l'ID \`${id}\` dans ${type}.`)] });
  }

  await db.ref(`${type}/${id}`).remove();

  message.reply({
    embeds: [successEmbed(
      'Supprimé !',
      `L'élément \`${id}\` a été supprimé de **${type}** et retiré du site.`
    )]
  });
}

async function cmdStatus(message) {
  const [annonces, musiques, artistes, pubs] = await Promise.all([
    db.ref('annonces').get(),
    db.ref('musiques').get(),
    db.ref('artistes').get(),
    db.ref('pubs').get()
  ]);

  const count = (snap) => snap.exists() ? Object.keys(snap.val()).length : 0;

  message.reply({
    embeds: [new EmbedBuilder()
      .setColor(0xC9A84C)
      .setTitle('📊 Contenu actuel du site JRLS')
      .addFields(
        { name: '📢 Annonces', value: `${count(annonces)} publiée(s)`, inline: true },
        { name: '🎵 Musiques', value: `${count(musiques)} son(s)`, inline: true },
        { name: '🎤 Artistes', value: `${count(artistes)} artiste(s)`, inline: true },
        { name: '📣 Pubs', value: `${count(pubs)} mise(s) en avant`, inline: true }
      )
      .setFooter({ text: 'JRLS Production · Firebase Realtime Database' })
      .setTimestamp()]
  });
}

// ═══════════════════════════════════════════════════════════════
//  EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════

client.once('ready', () => {
  console.log(`✦ JRLS Bot connecté : ${client.user.tag}`);
  client.user.setActivity('jrls-production.fr | !help', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;
  if (message.guild?.id !== JRLS_GUILD_ID) return;

  const { cmd, args } = parseArgs(message.content, PREFIX);

  // Commandes publiques
  if (cmd === 'help') {
    return message.reply({ embeds: [helpEmbed()] });
  }

  // Vérification admin pour les autres commandes
  if (!isAdmin(message.member)) {
    return message.reply({
      embeds: [errorEmbed('❌ Tu dois avoir le rôle **Admin** pour utiliser cette commande.')]
    });
  }

  try {
    switch (cmd) {
      case 'annonce':   await cmdAnnonce(message, args);   break;
      case 'musique':   await cmdMusique(message, args);   break;
      case 'artiste':   await cmdArtiste(message, args);   break;
      case 'pub':       await cmdPub(message, args);        break;
      case 'supprimer': await cmdSupprimer(message, args); break;
      case 'status':    await cmdStatus(message);           break;
      default:
        message.reply({ embeds: [errorEmbed(`Commande \`!${cmd}\` inconnue. Tape \`!help\` pour voir les commandes.`)] });
    }
  } catch (err) {
    console.error(`Erreur commande !${cmd}:`, err);
    message.reply({ embeds: [errorEmbed(`Une erreur s'est produite : ${err.message}`)] });
  }
});

client.login(process.env.DISCORD_TOKEN);
