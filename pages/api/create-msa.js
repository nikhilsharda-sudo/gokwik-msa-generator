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
    // Step 1: Use service account to copy the template
    const serviceAuth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/documents",
      ],
    });

    const serviceDrive = google.drive({ version: "v3", auth: serviceAuth });
    const serviceDocs = google.docs({ version: "v1", auth: serviceAuth });

    // Copy the template
    const docTitle = `${brandName} - MSA`;
    const copied = await serviceDrive.files.copy({
      fileId: TEMPLATE_DOC_ID,
      requestBody: { name: docTitle },
    });
    const newDocId = copied.data.id;

    // Replace "Brand Name" in header only
    const docData = await serviceDocs.documents.get({ documentId: newDocId });
    const headers = docData.data.headers;
    const headerIds = Object.keys(headers || {});

    if (headerIds.length > 0) {
      const headerId = headerIds[0];
      const headerContent = headers[headerId].content;

      for (const block of headerContent) {
        if (!block.paragraph) continue;
        for (const el of block.paragraph.elements) {
          if (!el.textRun) continue;
          const text = el.textRun.content;
          if (text.includes("Brand Name")) {
            const startIndex = el.startIndex;
            const endIndex = el.endIndex;
            const newText = text.replace("Brand Name", brandName);

            await serviceDocs.documents.batchUpdate({
              documentId: newDocId,
              requestBody: {
                requests: [
                  {
                    deleteContentRange: {
                      range: {
                        startIndex,
                        endIndex: endIndex - 1,
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

    // Step 2: Transfer ownership to the logged-in user
    await serviceDrive.permissions.create({
      fileId: newDocId,
      requestBody: {
        role: "owner",
        type: "user",
        emailAddress: session.user.email,
      },
      transferOwnership: true,
    });

    // Step 3: Set anyone with link can edit
    await serviceDrive.permissions.create({
      fileId: newDocId,
      requestBody: {
        role: "writer",
        type: "anyone",
      },
    });

    // Return the shareable link
    const shareableLink = `https://docs.google.com/document/d/${newDocId}/edit?usp=sharing`;
    return res.status(200).json({ url: shareableLink, title: docTitle });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to create document" });
  }
}
