export function toEmbeddedItemData(document, source = true) {
  if (typeof document?.toObject !== "function") return null;

  const itemData = document.toObject(source);
  delete itemData._id;
  return itemData;
}
