import { expandObject } from "../helpers/foundry-environment.js";

export function actor(balance = 1000, { persist = false } = {}) {
  const writes = [];
  const target = {
    name: "Crewmember", isOwner: true, writes, items: [{ id: "old", type: "item" }],
    system: { credits: { value: balance }, contractor: { baseSalary: balance } },
    update: async data => {
      writes.push(data);
      if (persist) {
        const update = expandObject(data);
        for (const [field, values] of Object.entries(update.system ?? {})) {
          target.system[field] = { ...target.system[field], ...values };
        }
        if (update.name !== undefined) target.name = update.name;
      }
    },
    deleteEmbeddedDocuments: async () => writes.push("delete"),
    createEmbeddedDocuments: async () => writes.push("create")
  };
  return target;
}
