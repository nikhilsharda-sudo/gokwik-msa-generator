import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { google } from "googleapis";
import { MSA_TEMPLATE } from "../../lib/template";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });

  const { brandName } = req.body;
  if (!brandName) return res.status(400).json({ error: "Brand name required" });

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const docs = google.docs({ version: "v1", auth });
    const drive = google.drive({ version: "v3", auth });

    // 1. Create the doc
    const docTitle = `MSA - ${brandName} - GoKwik`;
    const created = await docs.documents.create({ requestBody: { title: docTitle } });
    const docId = created.data.documentId;

    // 2. Insert MSA content
    const content = MSA_TEMPLATE.replace(/\{\{BRAND_NAME\}\}/g, brandName).trim();

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: content,
            },
          },
          {
            updateParagraphStyle: {
              range: { startIndex: 1, endIndex: content.indexOf("\n") + 1 },
              paragraphStyle: {
                namedStyleType: "HEADING_1",
                alignment: "CENTER",
              },
              fields: "namedStyleType,alignment",
            },
          },
        ],
      },
    });

    // 3. Set permission: anyone with link can EDIT
    await drive.permissions.create({
      fileId: docId,
      requestBody: {
        role: "writer",
        type: "anyone",
      },
    });

    // 4. Return the shareable link
    const shareableLink = `https://docs.google.com/document/d/${docId}/edit?usp=sharing`;
    return res.status(200).json({ url: shareableLink, title: docTitle });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create document" });
  }
}
