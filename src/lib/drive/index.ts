import { google } from 'googleapis'

function getDriveClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  return google.drive({ version: 'v3', auth })
}

export async function createClientFolder(businessName: string): Promise<string> {
  const drive = getDriveClient()
  const root = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID

  const res = await drive.files.create({
    requestBody: {
      name: businessName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: root ? [root] : undefined,
    },
    fields: 'id',
  })

  const folderId = res.data.id!

  await Promise.all(
    ['brutos', 'editados', 'reportes', 'assets'].map((sub) =>
      drive.files.create({
        requestBody: {
          name: sub,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [folderId],
        },
      }),
    ),
  )

  return folderId
}

export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId: string,
): Promise<{ id: string; webViewLink: string }> {
  const drive = getDriveClient()
  const { Readable } = await import('stream')

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [parentFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id,webViewLink',
  })

  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  })

  return { id: res.data.id!, webViewLink: res.data.webViewLink! }
}

export function getDriveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}
