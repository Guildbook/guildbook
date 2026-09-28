/** Page wording the Order of Saint Michael words its own way; every other guild gets neutral copy naming the guild. */
export function guildWording(guild: { preset: string; name: string }) {
  const order = guild.preset === "order";
  const name = guild.name;
  return {
    ranksHeading: order ? "Ranks of the Order" : `Ranks of ${name}`,
    progressionEyebrow: order ? "Deeds of the Order" : `Deeds of ${name}`,
    joined: order ? "Joined the Order" : `Joined ${name}`,
    lootEyebrow: order ? "The spoils of the Order" : `The spoils of ${name}`,
    addonsTitle: order ? "Addons of the Order" : "Guild Addons",
    addonsIntro: order
      ? "Custom tools our members write to help the Order prepare, execute and improve."
      : `Custom tools our members write to help ${name} prepare, execute and improve.`,
    rosterEyebrow: (count: number) =>
      order ? `${count} brothers and sisters in arms` : `${count} ${count === 1 ? "member" : "members"} of ${name}`,
    /** "Level 60 Holy Paladin" + this, for a character's page description. */
    characterOf: order ? `of the ${name}` : `of ${name}`,
  };
}
