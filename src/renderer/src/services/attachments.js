export async function chooseAttachment() {
  return await window.api.attachments.choose()
}

export async function saveAttachment(sourcePath) {
  return await window.api.attachments.save(sourcePath)
}