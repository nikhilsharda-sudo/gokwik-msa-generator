import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { google } from "googleapis";

const TEMPLATE_DOC_ID = "1AW63kWewbhq_WSccVx0M_9e9FcmpfWFgqgW4OjO0Ebo";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });

  const { brandName } = req.body;
  if (!brandName) return res.status(400).json({ error: "Brand name required" });

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });

    const drive = google.drive({ version: "v3", auth });
    const docs = google.docs({ version: "v1", auth });

    // 1. Copy the master template doc
    const docTitle = `${brandName} - MSA`;
    const copied = await drive.files.copy({
      fileId: TEMPLATE_DOC_ID,
      requestBody: { name: docTitle },
    });
    const newDocId = copied.data.id;

    // 2. Get the document to find the header ID
    const docData = await docs.documents.get({ documentId: newDocId });
    const headers = docData.data.headers;

    // Get the first header ID
    const headerIds = Object.keys(headers || {});

    if (headerIds.length > 0) {
      const headerId = headerIds[0];
      const headerContent = headers[headerId].content;

      // Find the text element containing "Brand Name" in the header
      for (const block of headerContent) {
        if (!block.paragraph) continue;
        for (const el of block.paragraph.elements) {
          if (!el.textRun) continue;
          const text = el.textRun.content;
          if (text.includes("Brand Name")) {
            const startIndex = el.startIndex;
            const endIndex = el.endIndex;
            const newText = text.replace("Brand Name", brandName);

            // Replace only this specific text element in the header
            await docs.documents.batchUpdate({
              documentId: newDocId,
              requestBody: {
                requests: [
                  {
                    deleteContentRange: {
                      range: {
                        startIndex,
                        endIndex: endIndex - 1, // exclude trailing newline
                        segmentId: headerId,
                      },
                    },
                  },
                  {
                    insertText: {
                      location: {
                        index: startIndex,
                        segmentId: headerId,
                      },
                      text: newText.replace(/\n$/, ""),
                    },
                  },
                ],
              },
            });
            break;
          }
        }
      }
    }

    // 3. Set permission: anyone with link can EDIT
    await drive.permissions.create({
      fileId: newDocId,
      requestBody: {
        role: "writer",
        type: "anyone",
      },
    });

    // 4. Return the shareable link
    const shareableLink = `https://docs.google.com/document/d/${newDocId}/edit?usp=sharing`;
    return res.status(200).json({ url: shareableLink, title: docTitle });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to create document" });
  }
}
