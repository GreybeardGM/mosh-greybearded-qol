import { getThemeColor } from "./utils/get-theme-color.js";

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

  // Normalize and build chat-action buttons
  if (Array.isArray(buttons)) {
    buttons.forEach(btn => {
      if (!btn.icon) btn.icon = "fa-dice";
  
      const action = btn.action || "";
      const args = btn.args || [];
      const argsString = JSON.stringify(args).replace(/"/g, "&quot;");
  
      btn.buttonHtml = `
        <div class="pill chat-action" data-action="${action}" data-args="${argsString}">
          <i class="fas ${btn.icon}"></i> ${btn.label}
        </div>
      `;
    });
  }

  // Prepare HTML via template
  const themeColor = getThemeColor();
  const html = await renderTemplate("modules/mosh-greybearded-qol/templates/chat-output.html", {
    actor,
    title,
    subtitle,
    content,
    icon,
    image,
    buttons,
    themeColor
  });

  // Send to chat
  if (roll instanceof Roll) {
    return roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: html });
  } else {
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: html });
  }
}
