import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { google } from "googleapis";

// Your master MSA template Google Doc ID
const TEMPLATE_DOC_ID = "1iFBATTwIerLx2G03DDMW8tioi73r4ioJNFNeDoJbLjI";

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

    // 1. Copy the master template doc
    const docTitle = `${brandName} - MSA`;
    const copied = await drive.files.copy({
      fileId: TEMPLATE_DOC_ID,
      requestBody: {
        name: docTitle,
      },
    });

    const newDocId = copied.data.id;

    // 2. Set permission: anyone with link can EDIT
    await drive.permissions.create({
      fileId: newDocId,
      requestBody: {
        role: "writer",
        type: "anyone",
      },
    });

    // 3. Return the shareable link
    const shareableLink = `https://docs.google.com/document/d/${newDocId}/edit?usp=sharing`;
    return res.status(200).json({ url: shareableLink, title: docTitle });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to create document" });
  }
}
