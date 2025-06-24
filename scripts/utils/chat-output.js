export async function chatOutput({
  actor,
  title = "Untitled",
  subtitle = "",
  content = "",
  icon = null,
  image = null,
  roll = null,
  buttons = []
} = {}) {
  // Fallback actor
  actor = actor || game.user.character;
  if (!actor) return ui.notifications.warn("No actor available for chat output.");

  // Normalize icon: if image is given, drop icon completely
  if (image) {
    icon = null;
  } else if (!icon && title) {
    const letter = title.charAt(0).toLowerCase();
    icon = `fa-${letter}`;
    title = title.slice(1);
  }

  // Normalize buttons
  if (Array.isArray(buttons)) {
    buttons.forEach(btn => {
      if (!btn.icon) btn.icon = "fa-dice";
    });
  }

  // Prepare HTML via template
  const html = await renderTemplate("modules/mosh-greybearded-qol/templates/chat-output.html", {
    actor,
    title,
    subtitle,
    content,
    icon,
    image,
    buttons
  });

  // Send to chat
  if (roll instanceof Roll) {
    return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: html });
  } else {
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html });
  }
}
