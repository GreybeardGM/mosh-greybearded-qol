import { SimpleShoreLeaveApp } from "./ui/simple-shore-leave-app.js";

export async function simpleShoreLeave(actor, randomFlavor) {
  if (!actor) return ui.notifications.warn("No actor provided.");
  return SimpleShoreLeaveApp.wait({ actor, randomFlavor });
}
