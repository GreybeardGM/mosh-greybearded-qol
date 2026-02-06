import { SimpleShoreLeaveApp } from "./ui/simple-shore-leave-app.js";

export async function simpleShoreLeave(actor, randomFlavor) {
  return SimpleShoreLeaveApp.wait({ actor, randomFlavor });
}
