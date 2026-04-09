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
    // Service account auth - to read the template
    const serviceAuth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    });

    // User auth - to create doc in their Drive
    const userAuth = new google.auth.OAuth2();
    userAuth.setCredentials({ access_token: session.accessToken });

    const serviceDrive = google.drive({ version: "v3", auth: serviceAuth });
    const userDrive = google.drive({ version: "v3", auth: userAuth });
    const userDocs = google.docs({ version: "v1", auth: userAuth });

    // Step 1: Export template as docx from service account
    const exported = await serviceDrive.files.export(
      { fileId: TEMPLATE_DOC_ID, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      { responseType: "arraybuffer" }
    );

    // Step 2: Upload to user's Drive as Google Doc
    const docTitle = `${brandName} - MSA`;
    const { Readable } = await import("stream");
    const stream = Readable.from(Buffer.from(exported.data));

    const uploaded = await userDrive.files.create({
      requestBody: {
        name: docTitle,
        mimeType: "application/vnd.google-apps.document",
      },
      media: {
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        body: stream,
      },
    });

    const newDocId = uploaded.data.id;

    // Step 3: Replace "Brand Name" in header only
    const docData = await userDocs.documents.get({ documentId: newDocId });
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

            await userDocs.documents.batchUpdate({
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

    // Step 4: Set anyone with link can edit
    await userDrive.permissions.create({
      fileId: newDocId,
      requestBody: {
        role: "writer",
        type: "anyone",
      },
    });

    const shareableLink = `https://docs.google.com/document/d/${newDocId}/edit?usp=sharing`;
    return res.status(200).json({ url: shareableLink, title: docTitle });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to create document" });
  }
}
