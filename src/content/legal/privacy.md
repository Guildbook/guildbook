# Guildbook Privacy Policy

Last updated: September 28, 2026

This policy explains what information Guildbook collects, why, who can see it, and the choices you have. It covers guildbook.io, every guild site on a guildbook.io subdomain (for example osm.guildbook.io), custom domains that guilds connect to Guildbook, and the Vigil companion app. Guildbook is run by Matthew Rosendin ("we", "us"), who is the data controller for the service.

Guildbook is free and non-commercial. **We don't sell your data, we don't show ads, and we don't use analytics or tracking tools.**

## The short version

- You sign in with Discord. We get your Discord ID, username, display name, avatar and email address.
- Linking Battle.net is optional. If you do, we store your Battle.net account ID, BattleTag and a snapshot of your character list. The Battle.net access token is encrypted and expires after about a day.
- Guilds store what you give them: your characters, applications and rank. Roster and character pages are public. Applications and the audit log are visible only to that guild's officers.
- Vigil analyses your combat log on your own computer. Only per-fight summaries are uploaded, they're private by default, and you choose who sees them.

## Information we collect

### When you sign in with Discord

We ask Discord for the `identify` and `email` permissions. From Discord we receive and store:

- your Discord user ID;
- your Discord username and display name;
- a link to your Discord avatar;
- your email address, and whether Discord says it is verified.

**We don't store Discord's access or refresh tokens.** Discord issues them when you sign in, and we discard them straight away; we keep only your Discord user ID and the permissions you granted. We never call Discord on your behalf.

We don't receive your Discord password, your servers, your friends list or your messages.

### When you link Battle.net (optional)

Linking Battle.net lets you prove that your characters are really yours. We ask Blizzard only for the `wow.profile` permission. We store:

- your Battle.net account ID, BattleTag and region;
- a snapshot of the World of Warcraft characters on your account: character ID, name, surname, realm, level, class, race, faction and guild name;
- when the snapshot was taken, and whether it was complete;
- the Battle.net access token, **encrypted at rest** (AES-256-GCM). Blizzard doesn't issue a refresh token, so this token stops working after about 24 hours and we can't use it after that.

Battle.net is never used to sign in.

### Guild membership and characters

When you join or apply to a guild, that guild stores:

- your membership status (applicant, active or former), rank, and the dates you joined and left;
- your characters: name, surname, faction, class, specialisation, role, level, realm, which one is your main, professions and skill levels, and whether the character is verified through Battle.net;
- for verified characters, the Blizzard character ID and when it was last synced.

Once a day, and whenever an officer asks, Guildbook checks verified characters against Blizzard's public character profiles to update their level and class. This uses Guildbook's own Blizzard app credentials, not your account token. **If you unlink Battle.net, syncing stops:** your characters stay on the roster but are marked unverified, and we forget their Blizzard character IDs.

### Applications

When you apply to a guild, we store your answers:

- the character you're applying with (name, surname, faction, class, specialisation, role and level);
- your free-text answers about raid experience, availability and why you want to join;
- your Discord handle;
- your agreement to the guild's charter;
- if your character is verified, its Blizzard character ID, realm, your BattleTag and the time of the snapshot used;
- the application's status, which officer reviewed it, when, and any decision note they wrote.

### Guild content and activity

Guild leaders create content such as guild pages (with a history of each edit and who made it), raid schedules, recruitment needs, boss kills (with an optional Warcraft Logs report code and note, and who recorded it) and addon listings. A guild can also store its Discord server ID and invite link, custom domains it has connected, and whether it appears in the public Guildbook directory. We record which user created each guild.

### Audit log

Each guild has an audit log of important actions, such as applications being submitted and withdrawn, rank changes, member removals, content edits, character changes, Battle.net linking and unlinking, changes to Vigil sharing, and deletion of Vigil reports. Each entry records who acted, what they did, what it affected, and the values before and after the change. Audit entries record character names but not your BattleTag. The log can't be edited or selectively deleted, so the guild has a reliable record of what happened. The only exceptions are the ones described under "How long we keep it": when an account is deleted, or an old application is removed, the entries stay but the person's identity in them is replaced with "Deleted user". Uploading a Vigil report is deliberately not logged, so a private report leaves no trace officers can see.

### Vigil fight summaries

Vigil works from the combat log file that World of Warcraft writes on your computer.

- **Your combat log never leaves your computer.** It is read and analysed locally, in your browser or in the companion app.
- Only a **summary of each fight you choose to upload** is sent to Guildbook. A summary covers your own character: the fight name and type, the encounter, the enemies involved and damage done to them, your character's name, in-game ID and level, your damage, healing and threat totals, a timeline of your casts, spell statistics, buff uptimes, resource use, cooldown and rotation analysis, and a score. If you choose to include the Vigil addon's snapshot file, the summary can also include your character's gear and talents.
- Summaries don't include other players' performance.
- Summaries are **private by default**. You can share each one with your guild's officers or with the whole guild, and you can set your own default. Shared reports stop being visible to others if you leave the guild.
- You can delete any of your reports at any time.

### The Vigil companion app

- The companion app reads only the newest `WoWCombatLog*.txt` file in the World of Warcraft Logs folder you point it to. If you ask it to, it copies the Vigil addon into your game's AddOns folder. It doesn't read other files, and it never reads or interacts with the running game.
- To pair it, you get a short-lived code on your guild site. We store only a **hash** of the code.
- A paired device receives a token. On your computer it is kept in your operating system's secure storage (Keychain on macOS, DPAPI on Windows) where available. On our side we store only a **SHA-256 hash** of the token, plus the device name, the last few characters of the token (so you can tell devices apart), when it was created and last used, whether it has been revoked, and a per-minute upload counter used for rate limiting.
- You can revoke a device at any time from your guild site.
- The companion app contains no analytics or tracking. It only talks to the Guildbook site you paired it with.

### Technical information

Like any website, our hosting provider receives your IP address, browser details and the pages you request when you visit. We use IP addresses briefly, in memory, to limit abusive traffic; we don't store them in our database. Our host may keep request and error logs for a short period, typically from an hour to a few days depending on our hosting plan, before they are deleted automatically.

## Why we use your information, and our legal bases

If you're in the European Economic Area, the UK or a similar jurisdiction, these are the legal bases we rely on:

| What | Why | Legal basis |
| --- | --- | --- |
| Discord sign-in data | To create your account, sign you in and show your name and avatar | Contract (providing the service you asked for) |
| Guild membership, characters, applications | To run the guilds you join or apply to | Contract |
| Battle.net link and snapshot | To verify your characters | Consent (you choose to link, and can unlink at any time) |
| Sharing Vigil reports | To show your summaries to officers or your guild | Consent (you choose each report's visibility) |
| Vigil summaries you keep private | To give you your own performance review | Contract |
| Audit log, rate limiting, security logs | To keep guilds accountable and the service secure | Legitimate interests |

We don't use your information for advertising, profiling or automated decisions with legal or similarly significant effects. Vigil scores are for your own review.

## Who can see what

### Public (anyone on the internet)

On a guild's site, anyone can see:

- the guild's name, description, pages, charter, schedule, recruitment needs, progression (boss kills) and addon listings;
- the **roster**: each active member's main character and alts, with name, surname, faction, class, specialisation, role, level, rank and whether the character is verified;
- **character pages**: the same details plus realm, professions and skill levels, the member's join date, when the character was last synced, and the member's other characters.

This means anyone can see which characters belong to the same member. Former members and archived characters aren't shown. Your Discord name, email, BattleTag and applications are never shown publicly.

If a guild opts into the Guildbook directory, its name and active member count are listed on guildbook.io.

### Visible to a guild's officers

- Applications to that guild, including your free-text answers, Discord handle and BattleTag.
- The guild's member list and ranks.
- The guild's audit log.
- Vigil reports you've shared with officers or the guild.

### Visible to guild members

- Vigil reports you've shared with the guild.

### Visible only to you

- Your private Vigil reports, your Battle.net link and character snapshot, and your paired devices.

### Service providers

We use these providers to run Guildbook:

- **Vercel** (hosting and serverless functions), United States.
- **Neon** (Postgres database hosting), in the United States (AWS us-east-2, Ohio).
- **Discord** (sign-in) and **Blizzard Entertainment** (optional Battle.net linking and public character data). These act as independent services under their own privacy policies.

We don't share your information with anyone else, except where the law requires it, to protect people's safety or our rights, or as part of a transfer of the service to a new operator who agrees to this policy.

## Where your data is stored

Your data is stored and processed in the United States. If you're outside the US, your information is transferred there. Where the law requires it, we rely on our providers' standard contractual clauses or equivalent safeguards for these transfers.

## How long we keep it

- **Account and Discord details:** until you delete your account.
- **Battle.net link:** until you unlink it or delete your account. **Unlinking deletes your stored Battle.net ID, BattleTag, character snapshot and token.** Characters you had verified stay on the guild roster but are marked unverified and stop syncing from Blizzard. The audit log keeps a record that you unlinked, without your BattleTag.
- **Battle.net access token:** it expires after about 24 hours. It's cleared if Blizzard rejects it, and deleted when you unlink.
- **Characters:** archived characters leave the roster but are kept so guild history stays intact, until the guild or your account is deleted.
- **Applications:** pending and accepted applications are kept for the guild's records until the guild or your account is deleted. **Withdrawn and declined applications are deleted automatically {{applicationRetentionDays}} days** after they were decided (or, if never reviewed, submitted), and the applicant's name is replaced with "Deleted user" in the audit entries about them.
- **Vigil reports:** until you delete them, or your membership, the guild or your account is deleted.
- **Companion devices:** until the membership, guild or account is deleted. Revoked devices stop working immediately.
- **Audit log:** kept for as long as the guild exists. When an account is deleted, its entries stay, de-identified as described below.
- **Guild content:** until guild leaders delete it or the guild is deleted. A guild's owner can delete the guild, with all of its members' guild data and its audit log, from the guild's settings.
- **Hosting logs:** as described under Technical information.

## Your rights

Depending on where you live, you may have the right to:

- **access** the personal information we hold about you;
- **export** it in a portable format;
- **correct** it;
- **delete** it;
- **object to** or **restrict** some uses;
- **withdraw consent** at any time, for example by unlinking Battle.net or making a Vigil report private again. This doesn't affect anything we did before you withdrew it.

Most of this you can do yourself:

- **Export your data:** on guildbook.io/account, "Download my data" gives you a JSON file with your profile, memberships, characters, applications, Vigil reports, devices and the audit entries you made.
- **Delete your account:** on guildbook.io/account, type your name to confirm. If you're the only admin of a guild that has other members, you'll be asked to promote another member to an admin rank (or delete the guild) first. A guild where you're the only member is deleted along with your account.
- Edit or archive your characters, withdraw pending applications, change the visibility of or delete Vigil reports, revoke companion devices, and unlink Battle.net.

For anything else, email [matt.rosendin@gmail.com](mailto:matt.rosendin@gmail.com) from the address on your Discord account, or tell us your Discord username so we can confirm it's you. We'll respond within 7 days.

When you delete your account, we delete your profile, Discord sign-in, memberships, characters, applications, Vigil reports and preferences, companion devices and Battle.net link and token. Guild content you edited as an officer stays with the guild, without your name attached. **Audit log entries are de-identified:** each entry is kept with its action and date, but you're shown as "Deleted user" and your name, character names, BattleTag and Discord handle in it are replaced with "Deleted user". Copies in our database provider's backups expire on its normal backup schedule.

You can also complain to your local data protection authority.

## Children

Guildbook is not for children under 13, and you must also meet Discord's minimum age where you live. We don't knowingly collect information from anyone under 13. If you believe a child under 13 is using Guildbook, contact us and we'll delete the account.

## Security

We protect your information with:

- HTTPS for all traffic;
- signed, HTTP-only session cookies;
- AES-256-GCM encryption for Battle.net access tokens;
- storing only hashes of companion pairing codes and device tokens;
- access controls that keep each guild's data separate and limit applications, the audit log and shared reports to the right ranks;
- one-time, 60-second tokens when signing you in to a guild's custom domain;
- rate limiting on companion pairing, Vigil uploads from the companion, and guild creation.

No system is perfectly secure. If a breach affects your personal information, we'll notify you and the authorities as the law requires.

## Cookies

We use **only essential cookies**, needed for sign-in and security:

- **Session cookie** (`authjs.session-token`): a signed, encrypted token (JWT) that keeps you signed in, for up to 30 days. It's shared across guildbook.io and its guild subdomains so you only sign in once. A guild on a custom domain gets its own session cookie for that domain.
- **Sign-in security cookies** set by our sign-in library (such as `authjs.csrf-token`, `authjs.callback-url`, and short-lived OAuth state cookies) to protect the Discord sign-in flow.
- **Battle.net linking cookie** (`bnet_oauth`): protects the Battle.net linking flow and expires after 10 minutes.

We don't use analytics, advertising or tracking cookies, and we don't use third-party trackers. Because these cookies are essential, we don't ask for consent to them. Blocking them will stop you signing in.

## Changes to this policy

We may update this policy. When we do, we'll change the "Last updated" date above, and for significant changes we'll try to give notice on the site before they take effect.

## Contact

Questions or requests about your privacy: [matt.rosendin@gmail.com](mailto:matt.rosendin@gmail.com).
